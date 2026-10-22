#!/usr/bin/env bash
# Starts the Spring app and the Node app side by side on fresh databases, runs the differential contract suite,
# and writes contract/results/<profile>.md (+ JUnit XML).
#   Usage: contract/run-contract.sh [h2|postgres|mysql]
#   h2       Spring on embedded H2   vs Node on in-memory SQLite (the default profiles)
#   postgres Spring and Node each on their own database in one Postgres container
#   mysql    Spring and Node each on their own database in one MySQL container
set -euo pipefail

PROFILE="${1:-h2}"
NODE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$NODE_DIR/.." && pwd)"
RESULTS="$NODE_DIR/contract/results"
JAVA_PORT="${JAVA_PORT:-18080}"
NODE_PORT="${NODE_PORT:-18081}"
CONTAINER="petclinic-contract-$PROFILE"
mkdir -p "$RESULTS"

JAR="$(ls "$ROOT"/target/spring-petclinic-*.jar 2>/dev/null | head -1 || true)"
if [[ -z "$JAR" ]]; then
	(cd "$ROOT" && ./mvnw -q -B -DskipTests package)
	JAR="$(ls "$ROOT"/target/spring-petclinic-*.jar | head -1)"
fi

PIDS=()
cleanup() {
	for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
	docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for() {
	for _ in $(seq 1 120); do
		curl -sf -o /dev/null "$1" && return 0
		sleep 1
	done
	echo "Timed out waiting for $1" >&2
	return 1
}

for port in "$JAVA_PORT" "$NODE_PORT"; do
	if curl -s -o /dev/null "http://localhost:$port/"; then
		echo "Port $port is already in use; stop that process first" >&2
		exit 1
	fi
done

JAVA_ENV=()
JAVA_ARGS=()
NODE_ENV=()
case "$PROFILE" in
	h2)
		NODE_ENV=(DB_PROFILE=sqlite)
		;;
	postgres)
		docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
		docker run -d --name "$CONTAINER" -p 15432:5432 -e POSTGRES_USER=petclinic -e POSTGRES_PASSWORD=petclinic \
			-e POSTGRES_DB=petclinic_java postgres:18.4 >/dev/null
		until docker exec "$CONTAINER" pg_isready -U petclinic -d petclinic_java >/dev/null 2>&1; do sleep 1; done
		sleep 2
		docker exec "$CONTAINER" psql -U petclinic -d petclinic_java -c 'CREATE DATABASE petclinic_node' >/dev/null
		JAVA_ARGS=(--spring.profiles.active=postgres)
		JAVA_ENV=(POSTGRES_URL=jdbc:postgresql://localhost:15432/petclinic_java)
		NODE_ENV=(DB_PROFILE=postgres POSTGRES_URL=postgres://localhost:15432/petclinic_node)
		export JAVA_DB_URL=postgres://petclinic:petclinic@localhost:15432/petclinic_java
		export NODE_DB_URL=postgres://petclinic:petclinic@localhost:15432/petclinic_node
		;;
	mysql)
		docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
		docker run -d --name "$CONTAINER" -p 13306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_USER=petclinic \
			-e MYSQL_PASSWORD=petclinic -e MYSQL_DATABASE=petclinic_java mysql:9.7 >/dev/null
		until docker exec "$CONTAINER" mysql -uroot -proot -e 'SELECT 1' >/dev/null 2>&1; do sleep 2; done
		docker exec "$CONTAINER" mysql -uroot -proot -e \
			"CREATE DATABASE petclinic_node; GRANT ALL ON petclinic_node.* TO 'petclinic'@'%'; FLUSH PRIVILEGES;" 2>/dev/null
		JAVA_ARGS=(--spring.profiles.active=mysql)
		JAVA_ENV=(MYSQL_URL=jdbc:mysql://localhost:13306/petclinic_java)
		NODE_ENV=(DB_PROFILE=mysql MYSQL_URL=mysql://localhost:13306/petclinic_node)
		export JAVA_DB_URL=mysql://petclinic:petclinic@localhost:13306/petclinic_java
		export NODE_DB_URL=mysql://petclinic:petclinic@localhost:13306/petclinic_node
		;;
	*)
		echo "Unknown profile '$PROFILE' (expected h2, postgres or mysql)" >&2
		exit 2
		;;
esac

exec_java() { exec env "${JAVA_ENV[@]}" java -jar "$JAR" --server.port="$JAVA_PORT" "${JAVA_ARGS[@]}"; }
(exec_java) >"$RESULTS/java-$PROFILE.log" 2>&1 &
PIDS+=($!)
(cd "$NODE_DIR" && exec env "${NODE_ENV[@]}" PORT="$NODE_PORT" SESSION_SECRET=contract node --import tsx src/server.ts) >"$RESULTS/node-$PROFILE.log" 2>&1 &
PIDS+=($!)
wait_for "http://localhost:$JAVA_PORT/owners/find"
wait_for "http://localhost:$NODE_PORT/owners/find"

cd "$NODE_DIR"
JAVA_BASE_URL="http://localhost:$JAVA_PORT" NODE_BASE_URL="http://localhost:$NODE_PORT" CONTRACT_PROFILE="$PROFILE" \
	npx vitest run --dir contract --reporter=verbose --reporter=junit --outputFile.junit="contract/results/$PROFILE-junit.xml"
