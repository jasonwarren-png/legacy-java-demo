// Node-only tests for cross-cutting web behavior (flash, locale, method handling, errors, legacy proxy).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, initDb } from '../src/db/database.js';
import { isProxiedToLegacy } from '../src/web/legacyProxy.js';
import { testApp, type TestApp } from './support.js';

describe('web layer', () => {
	let t: TestApp | undefined;
	let upstream: Server | undefined;

	afterEach(async () => {
		await t?.db.close();
		upstream?.close();
		t = undefined;
		upstream = undefined;
	});

	it('shows a flash message once, on the redirect target only', async () => {
		t = await testApp();
		const agent = request.agent(t.app);
		const created = await agent.post('/owners/new').type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: '1 St', city: 'London', telephone: '0123456789' });
		expect(created.status).toBe(302);
		expect((await agent.get('/owners/find')).text).not.toContain('New Owner Created');
		expect((await agent.get('/owners/11')).text).toContain('New Owner Created');
		expect((await agent.get('/owners/11')).text).not.toContain('New Owner Created');
	});

	it('keeps ?lang= in the session and resets it with an empty value', async () => {
		t = await testApp();
		const agent = request.agent(t.app);
		const de = await agent.get('/owners/find?lang=de');
		expect(de.headers['content-language']).toBe('de');
		expect((await agent.get('/owners/find')).text).toContain('Besitzer suchen');
		expect((await agent.get('/owners/find?lang=')).headers['content-language']).toBe('en');
		expect((await agent.get('/owners/find')).headers['content-language']).toBe('en');
	});

	it('rejects an invalid ?lang= with a 500 without breaking the session', async () => {
		t = await testApp();
		const agent = request.agent(t.app);
		await agent.get('/owners/find?lang=de');
		expect((await agent.get('/owners/find?lang=de%0d%0aX:1')).status).toBe(500);
		const next = await agent.get('/owners/find');
		expect(next.status).toBe(200);
		expect(next.headers['content-language']).toBe('de');
	});

	it('answers 405 with Allow, OPTIONS, and Spring-style JSON errors', async () => {
		t = await testApp();
		const put = await request(t.app).put('/owners/new');
		expect(put.status).toBe(405);
		expect(put.headers.allow).toBe('GET, POST');
		expect((await request(t.app).options('/owners/1')).headers.allow).toBe('GET,HEAD,OPTIONS');
		const missing = await request(t.app).get('/owners/999');
		expect(missing.status).toBe(500);
		expect(missing.headers['content-type']).toBe('application/json');
		expect(missing.body).toMatchObject({ status: 500, error: 'Internal Server Error', path: '/owners/999' });
		expect((await request(t.app).get('/owners/').set('Accept', 'text/html')).status).toBe(404);
	});

	it('blocks actuator endpoints other than health and info, including encoded and traversal variants', () => {
		for (const allowed of ['/', '/vets.html', '/owners/1/pets/new', '/actuator/health', '/actuator/health/liveness', '/actuator/info', '/actuator/info/']) {
			expect(isProxiedToLegacy(allowed), allowed).toBe(true);
		}
		for (const blocked of [
			'/actuator', '/actuator/', '/actuator/env', '/actuator/beans', '/actuator/heapdump', '/ACTUATOR/env',
			'/actuator/health/../env', '/actuator/health/..%2fenv', '/%61ctuator/env', '//actuator/env', '/./actuator/env',
			'/actuator;x=1/env', '/actuator/env;x=1', '/vets/../actuator/env', '/actuator/%65nv', '/actuator/infox', '/%zz',
		]) {
			expect(isProxiedToLegacy(blocked), blocked).toBe(false);
		}
	});

	it('forwards unported routes, including form bodies, to the legacy app', async () => {
		let received = '';
		upstream = createServer((req, res) => {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', () => {
				received = `${req.method} ${req.url} ${body}`;
				res.writeHead(302, { Location: '/owners/2' }).end();
			});
		});
		await new Promise<void>((resolve) => upstream?.listen(0, resolve));
		const port = (upstream.address() as AddressInfo).port;
		const config = loadConfig({ DB_PROFILE: 'sqlite', SESSION_SECRET: 'test', LEGACY_UPSTREAM_URL: `http://localhost:${port}` });
		const db = createDb(config);
		await initDb(db);
		t = { app: createApp(config, db), db };
		const res = await request(t.app).post('/owners/2/pets/new').type('form').send({ name: 'Rex', birthDate: '2020-01-01', type: 'dog' });
		expect(res.status).toBe(302);
		expect(received).toBe('POST /owners/2/pets/new name=Rex&birthDate=2020-01-01&type=dog');

		received = '';
		expect((await request(t.app).get('/actuator/env')).status).toBe(404);
		expect(received).toBe('');
		await request(t.app).get('/actuator/health');
		expect(received).toBe('GET /actuator/health ');
	});
});
