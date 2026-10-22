export type DbProfile = 'sqlite' | 'postgres' | 'mysql';

export interface DbConnection {
	url: string;
	user: string;
	password: string;
}

export interface Config {
	port: number;
	db: DbProfile;
	postgres: DbConnection;
	mysql: DbConnection;
	/** Base URL of the legacy Spring app; routes not yet ported are proxied there (strangler pattern). */
	legacyUpstreamUrl?: string;
	sessionSecret?: string;
}

function dbProfile(value: string | undefined): DbProfile {
	const profile = (value ?? 'sqlite').toLowerCase();
	if (profile === 'sqlite' || profile === 'postgres' || profile === 'mysql') {
		return profile;
	}
	throw new Error(`Unsupported DB_PROFILE '${value}' (expected sqlite, postgres or mysql)`);
}

/** Accepts the JDBC URLs used by the Spring profiles (jdbc:postgresql://host/db) as well as plain URLs. */
export function toDriverUrl(url: string): string {
	return url.replace(/^jdbc:/, '').replace(/^postgresql:/, 'postgres:');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	return {
		port: Number(env.PORT ?? 8080),
		db: dbProfile(env.DB_PROFILE),
		postgres: {
			url: env.POSTGRES_URL ?? 'jdbc:postgresql://localhost/petclinic',
			user: env.POSTGRES_USER ?? 'petclinic',
			password: env.POSTGRES_PASS ?? 'petclinic',
		},
		mysql: {
			url: env.MYSQL_URL ?? 'jdbc:mysql://localhost/petclinic',
			user: env.MYSQL_USER ?? 'petclinic',
			password: env.MYSQL_PASS ?? 'petclinic',
		},
		legacyUpstreamUrl: env.LEGACY_UPSTREAM_URL || undefined,
		sessionSecret: env.SESSION_SECRET || undefined,
	};
}
