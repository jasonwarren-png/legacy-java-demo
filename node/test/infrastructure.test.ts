// Node-only tests for the session store and the SQLite LIKE override.
import { describe, expect, it } from 'vitest';
import { likeToRegExp } from '../src/db/database.js';
import { IdleTimeoutMemoryStore } from '../src/web/sessionStore.js';

describe('IdleTimeoutMemoryStore', () => {
	it('drops sessions idle for longer than the timeout', () => {
		let now = 0;
		const store = new IdleTimeoutMemoryStore(1000, () => now);
		const data = { cookie: { originalMaxAge: null }, locale: 'de' } as never;
		store.set('a', data);
		store.set('b', data);
		now = 600;
		store.get('a', () => undefined);
		now = 1200;
		store.prune();
		expect(store.size).toBe(1);
		let result: unknown;
		store.get('a', (_err, s) => (result = s));
		expect(result).toMatchObject({ locale: 'de' });
		now = 5000;
		store.get('a', (_err, s) => (result = s));
		expect(result).toBeNull();
	});
});

describe('SQLite LIKE override', () => {
	it('matches case-insensitively beyond ASCII and honours the escape character', () => {
		expect(likeToRegExp('ü%').test('Ünal')).toBe(true);
		expect(likeToRegExp('da%').test('Davis')).toBe(true);
		expect(likeToRegExp('\\_avis%', '\\').test('Davis')).toBe(false);
		expect(likeToRegExp('\\%%', '\\').test('%x')).toBe(true);
		expect(likeToRegExp('a.b%').test('axb')).toBe(false);
	});
});
