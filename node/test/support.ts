import type { Express } from 'express';
import { createApp, type AppDependencies } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, initDb, type Db } from '../src/db/database.js';

export interface TestApp {
	app: Express;
	db: Db;
}

/** The app on a fresh in-memory SQLite database seeded with the same data as the Spring app's H2 profile. */
export async function testApp(deps: AppDependencies = {}): Promise<TestApp> {
	const config = loadConfig({ DB_PROFILE: 'sqlite', SESSION_SECRET: 'test' });
	const db = createDb(config);
	await initDb(db);
	return { app: createApp(config, db, deps), db };
}
