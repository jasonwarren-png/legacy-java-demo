# PetClinic: Node.js port (TypeScript + Express)

Phase 1 of the Java/Spring to Node.js migration: the **Owners** domain is ported, with the same behavior as the
Spring app: the same HTML, redirects, flash messages, validation messages in every locale, status codes and
database effects.

| Ported (Node) | Still served by Spring |
|---|---|
| `GET /owners/find`, `GET /owners` (search, paging), `GET/POST /owners/new`, `GET /owners/{id}`, `GET/POST /owners/{id}/edit` | `/`, `/oups`, `/vets*`, `/owners/{id}/pets/**` (pets and visits) |

Set `LEGACY_UPSTREAM_URL` (for example `http://localhost:8080`) and the Node app proxies every route it doesn't
own to the Spring app (strangler pattern). Without it, those routes return the Spring-style 404.

## Layout

```
src/
  config.ts             env config (DB_PROFILE, POSTGRES_*/MYSQL_* as in the Spring profiles, PORT, LEGACY_UPSTREAM_URL)
  db/                   Kysely setup; runs the Spring schema.sql/data.sql at startup (spring.sql.init.mode=always)
  model/, owner/        Owner aggregate, repository (OwnerRepository), validation rules, routes (OwnerController)
  validation/           Bean Validation equivalents (@NotBlank/@Size/@Pattern + Hibernate Validator messages)
  i18n/                 .properties MessageSource (reads ../src/main/resources/messages unchanged), locales
  web/                  rendering, redirects + flash, ?lang= session locale, Spring-compatible error handling
views/                  Nunjucks ports of the Thymeleaf templates
sql/sqlite/schema.sql   SQLite version of the H2 schema (the default profile); seed data comes from the H2 data.sql
i18n/                   Hibernate Validator 9.1.0 ValidationMessages bundles (Apache-2.0)
test/                   unit tests (ports of OwnerControllerTests, OwnerTests, ValidatorTests + helpers)
contract/               differential contract tests: Java vs Node
```

## Run

```bash
npm ci
npm run dev                                  # in-memory SQLite (equivalent of the default H2 profile), port 8080
DB_PROFILE=postgres POSTGRES_URL=jdbc:postgresql://localhost/petclinic npm run dev
DB_PROFILE=mysql MYSQL_URL=jdbc:mysql://localhost/petclinic npm run dev
```

## Test

```bash
npm run lint && npm run typecheck && npm test
npm run contract:run -- h2          # Spring/H2      vs Node/SQLite
npm run contract:run -- postgres    # Spring/Postgres vs Node/Postgres (Docker), plus a DB row comparison
npm run contract:run -- mysql       # Spring/MySQL    vs Node/MySQL    (Docker), plus a DB row comparison
```

`contract:run` builds the Spring jar if needed, starts both apps on fresh databases (ports 18080/18081), replays
`contract/scenarios.ts` against both in order, and writes `contract/results/<profile>.md` (+ JUnit XML, and
`<profile>-mismatches.json` when something differs; `python3 contract/show-mismatches.py <profile>` prints a diff).

What the contract suite normalizes, and why, is documented in `contract/normalize.ts`:
- transport headers such as `Date` and `Content-Length`;
- the host part of `Location`;
- the session cookie name and value (`JSESSIONID` vs `petclinic.sid`);
- whitespace between tags;
- the order of several validation messages on one field, and of `Allow` methods (both vary between runs of the Java app);
- Tomcat's `;jsessionid=` URL rewriting.
