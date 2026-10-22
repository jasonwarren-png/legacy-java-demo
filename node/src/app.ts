import express, { type Express } from 'express';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import type { Db } from './db/database.js';
import { OwnerRepository } from './owner/ownerRepository.js';
import { ownerRoutes } from './owner/ownerRoutes.js';
import { errorHandler, notFoundHandler } from './web/errorHandling.js';
import { flashMiddleware, localeMiddleware, stripMatrixParams } from './web/view.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = resolve(projectRoot, '../src/main/resources/static');
const STATIC_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface AppDependencies {
	ownerRepository?: OwnerRepository;
}

export function createApp(config: Config, db: Db, deps: AppDependencies = {}): Express {
	const app = express();
	app.disable('x-powered-by');
	app.set('etag', false);
	app.set('query parser', 'simple');
	app.set('trust proxy', true);
	app.set('strict routing', true);

	app.use(stripMatrixParams);

	const cacheControl = { setHeaders: (res: express.Response) => res.set('Cache-Control', `max-age=${STATIC_MAX_AGE_SECONDS}`) };
	app.use('/resources', express.static(resolve(staticDir, 'resources'), cacheControl));
	for (const [name, version] of [['bootstrap', '5.3.8'], ['font-awesome', '4.7.0']] as const) {
		const dir = resolve(projectRoot, 'node_modules', name);
		app.use(`/webjars/${name}/${version}`, express.static(dir, cacheControl));
		app.use(`/webjars/${name}`, express.static(dir, cacheControl));
	}

	app.use(session({
		name: 'petclinic.sid',
		secret: config.sessionSecret ?? randomBytes(32).toString('hex'),
		resave: false,
		saveUninitialized: false,
		cookie: { httpOnly: true, path: '/' },
	}));
	app.use(localeMiddleware);
	app.use(flashMiddleware);

	app.use(ownerRoutes(deps.ownerRepository ?? new OwnerRepository(db)));

	if (config.legacyUpstreamUrl) {
		// Strangler pattern: everything not ported yet is served by the Spring app.
		app.use(createProxyMiddleware({ target: config.legacyUpstreamUrl, changeOrigin: false, xfwd: true }));
	}
	app.use(notFoundHandler);
	app.use(errorHandler);
	return app;
}
