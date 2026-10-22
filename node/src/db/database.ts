import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import SQLite from 'better-sqlite3';
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect, sql } from 'kysely';
import { createPool } from 'mysql2';
import pg from 'pg';
import type { Config, DbProfile } from '../config.js';
import { toDriverUrl } from '../config.js';
import type { Database } from './schema.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The Spring app's SQL scripts, reused unchanged for MySQL and Postgres (and for SQLite seed data). */
const springDbDir = resolve(projectRoot, '../src/main/resources/db');

export interface Db {
	kysely: Kysely<Database>;
	profile: DbProfile;
	close(): Promise<void>;
}

const PG_DATE_OID = 1082;

/** SQL LIKE pattern (with optional ESCAPE character) as a case-insensitive, Unicode-aware RegExp. */
export function likeToRegExp(pattern: string, escape?: string): RegExp {
	let source = '';
	const chars = [...pattern];
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i] as string;
		if (escape !== undefined && c === escape && i + 1 < chars.length) {
			source += (chars[++i] as string).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
		}
		else if (c === '%') {
			source += '[\\s\\S]*';
		}
		else if (c === '_') {
			source += '[\\s\\S]';
		}
		else {
			source += c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
		}
	}
	return new RegExp(`^${source}$`, 'iu');
}

/** POSTGRES_USER/PASS (or MYSQL_*) apply unless the URL already carries credentials, as with the Spring datasource. */
function withCredentials(url: string, credentials: { user: string; password: string }): string {
	const parsed = new URL(url);
	if (!parsed.username) {
		parsed.username = encodeURIComponent(credentials.user);
		parsed.password = encodeURIComponent(credentials.password);
	}
	return parsed.toString();
}

export function createDb(config: Config): Db {
	let kysely: Kysely<Database>;
	if (config.db === 'sqlite') {
		const sqlite = new SQLite(':memory:');
		sqlite.pragma('foreign_keys = ON');
		// H2's VARCHAR_IGNORECASE matches case-insensitively for all letters; SQLite's built-in LIKE only folds ASCII.
		sqlite.function('like', { deterministic: true, varargs: true }, (pattern: unknown, value: unknown, escape?: unknown) =>
			pattern == null || value == null ? null : Number(likeToRegExp(String(pattern), escape == null ? undefined : String(escape)).test(String(value))));
		kysely = new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
	}
	else if (config.db === 'postgres') {
		pg.types.setTypeParser(PG_DATE_OID, (value: string) => value);
		const pool = new pg.Pool({ connectionString: withCredentials(toDriverUrl(config.postgres.url), config.postgres) });
		kysely = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
	}
	else {
		const pool = createPool({ uri: withCredentials(toDriverUrl(config.mysql.url), config.mysql), dateStrings: true });
		kysely = new Kysely<Database>({ dialect: new MysqlDialect({ pool }) });
	}
	return { kysely, profile: config.db, close: () => kysely.destroy() };
}

/** Same splitting rules as Spring's ScriptUtils: drop `--` comment lines, split on `;`. */
export function splitSqlScript(script: string): string[] {
	return script
		.split('\n')
		.filter((line) => !line.trim().startsWith('--'))
		.join('\n')
		.split(/;\s*(?:\n|$)/)
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

function scripts(profile: DbProfile): string[] {
	if (profile === 'sqlite') {
		const schema = readFileSync(resolve(projectRoot, 'sql/sqlite/schema.sql'), 'utf8');
		// H2 seed data, with the H2-only `default` identity keyword mapped to SQLite's NULL.
		const data = readFileSync(resolve(springDbDir, 'h2/data.sql'), 'utf8').replace(/VALUES \(default,/g, 'VALUES (NULL,');
		return [schema, data];
	}
	return ['schema.sql', 'data.sql'].map((file) => readFileSync(resolve(springDbDir, profile, file), 'utf8'));
}

/** Mirrors `spring.sql.init.mode=always`: run schema.sql then data.sql on every start. */
export async function initDb(db: Db): Promise<void> {
	for (const script of scripts(db.profile)) {
		for (const statement of splitSqlScript(script)) {
			await sql.raw(statement).execute(db.kysely);
		}
	}
}
