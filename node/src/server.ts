import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb, initDb } from './db/database.js';

const config = loadConfig();
const db = createDb(config);
await initDb(db);
const server = createApp(config, db).listen(config.port, () => {
	console.log(`PetClinic (Node) listening on port ${config.port} with DB profile '${config.db}'`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		server.close(() => void db.close().then(() => process.exit(0)));
	});
}
