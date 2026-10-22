// Port of src/test/java/.../owner/OwnerControllerTests.java. The Java tests mock OwnerRepository and assert on
// the Spring model/view; these run against the seeded SQLite database and assert on the HTTP response instead.
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerRepository } from '../src/owner/ownerRepository.js';
import { testApp, type TestApp } from './support.js';

const TEST_OWNER_ID = 1;

describe('OwnerController', () => {
	let t: TestApp;

	beforeEach(async () => {
		t = await testApp();
	});

	afterEach(async () => {
		await t.db.close();
	});

	it('initCreationForm', async () => {
		const res = await request(t.app).get('/owners/new');
		expect(res.status).toBe(200);
		expect(res.text).toContain('id="add-owner-form"');
		expect(res.text).toContain('>Add Owner</button>');
	});

	it('processCreationFormSuccess', async () => {
		const res = await request(t.app)
			.post('/owners/new')
			.type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: '123 Caramel Street', city: 'London', telephone: '1316761638' });
		expect(res.status).toBe(302);
		expect(res.headers.location).toMatch(/\/owners\/11$/);
	});

	it('processCreationFormHasErrors', async () => {
		const res = await request(t.app).post('/owners/new').type('form').send({ firstName: 'Joe', lastName: 'Bloggs', city: 'London' });
		expect(res.status).toBe(200);
		expect(fieldErrors(res.text)).toEqual({ address: ['must not be blank'], telephone: ['must not be blank'] });
	});

	it('processCreationFormRejectsCityLongerThanColumn', async () => {
		const res = await request(t.app)
			.post('/owners/new')
			.type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: '123 Caramel Street', city: 'C'.repeat(81), telephone: '1316761638' });
		expect(res.status).toBe(200);
		expect(fieldErrors(res.text)).toEqual({ city: ['size must be between 0 and 80'] });
	});

	it('processCreationFormRejectsAddressLongerThanColumn', async () => {
		const res = await request(t.app)
			.post('/owners/new')
			.type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: 'A'.repeat(256), city: 'London', telephone: '1316761638' });
		expect(res.status).toBe(200);
		expect(fieldErrors(res.text)).toEqual({ address: ['size must be between 0 and 255'] });
	});

	it('initFindForm', async () => {
		const res = await request(t.app).get('/owners/find');
		expect(res.status).toBe(200);
		expect(res.text).toContain('id="search-owner-form"');
	});

	it('processFindFormSuccess', async () => {
		const res = await request(t.app).get('/owners?page=1');
		expect(res.status).toBe(200);
		expect(res.text).toContain('<table id="owners"');
	});

	it('processFindFormRedirectsOutOfBoundsPageToFirstPage', async () => {
		for (const page of [0, 2]) {
			const res = await request(t.app).get('/owners').query({ page, lastName: 'Franklin' });
			expect(res.status).toBe(302);
			expect(new URL(res.headers.location as string).pathname + new URL(res.headers.location as string).search).toBe('/owners?page=1&lastName=Franklin');
		}
	});

	it('processFindFormByLastName', async () => {
		const res = await request(t.app).get('/owners?page=1').query({ lastName: 'Franklin' });
		expect(res.status).toBe(302);
		expect(res.headers.location).toMatch(new RegExp(`/owners/${TEST_OWNER_ID}$`));
	});

	it('processFindFormIgnoresSurroundingWhitespace', async () => {
		for (const lastName of [' Franklin', 'Franklin ', ' Franklin ']) {
			const res = await request(t.app).get('/owners?page=1').query({ lastName });
			expect(res.status).toBe(302);
			expect(res.headers.location).toMatch(new RegExp(`/owners/${TEST_OWNER_ID}$`));
		}
	});

	it('processFindFormWithWhitespaceOnlyLastNameReturnsAllOwners', async () => {
		const spy = vi.spyOn(OwnerRepository.prototype, 'findByLastNameStartingWith');
		const res = await request(t.app).get('/owners?page=1').query({ lastName: '   ' });
		expect(res.status).toBe(200);
		expect(res.text).toContain('<table id="owners"');
		expect(spy).toHaveBeenCalledWith('', 0, 5);
		spy.mockRestore();
	});

	it('processFindFormNoOwnersFound', async () => {
		const res = await request(t.app).get('/owners?page=1').query({ lastName: 'Unknown Surname' });
		expect(res.status).toBe(200);
		expect(res.text).toContain('<p>has not been found</p>');
		expect(res.text).toContain('id="search-owner-form"');
	});

	it('initUpdateOwnerForm', async () => {
		const res = await request(t.app).get(`/owners/${TEST_OWNER_ID}/edit`);
		expect(res.status).toBe(200);
		for (const [name, value] of Object.entries({ lastName: 'Franklin', firstName: 'George', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023' })) {
			expect(res.text).toContain(`name="${name}" value="${value}"`);
		}
		expect(res.text).toContain('>Update Owner</button>');
	});

	it('processUpdateOwnerFormSuccess', async () => {
		const res = await request(t.app)
			.post(`/owners/${TEST_OWNER_ID}/edit`)
			.type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: '123 Caramel Street', city: 'London', telephone: '1616291589' });
		expect(res.status).toBe(302);
		expect(res.headers.location).toMatch(new RegExp(`/owners/${TEST_OWNER_ID}$`));
	});

	it('processUpdateOwnerFormUnchangedSuccess', async () => {
		const res = await request(t.app).post(`/owners/${TEST_OWNER_ID}/edit`);
		expect(res.status).toBe(302);
		expect(res.headers.location).toMatch(new RegExp(`/owners/${TEST_OWNER_ID}$`));
	});

	it('processUpdateOwnerFormHasErrors', async () => {
		const res = await request(t.app)
			.post(`/owners/${TEST_OWNER_ID}/edit`)
			.type('form')
			.send({ firstName: 'Joe', lastName: 'Bloggs', address: '', telephone: '' });
		expect(res.status).toBe(200);
		expect(Object.keys(fieldErrors(res.text)).sort()).toEqual(['address', 'telephone']);
	});

	it('showOwner', async () => {
		const res = await request(t.app).get('/owners/6');
		expect(res.status).toBe(200);
		expect(res.text).toContain('<b>Jean Coleman</b>');
		expect(res.text).toContain('<td>105 N. Lake St.</td>');
		expect(res.text).toContain('<td>Monona</td>');
		expect(res.text).toContain('<td>6085552654</td>');
		expect(res.text).toContain('<dd>Max</dd>');
		expect(res.text).toContain('<td>rabies shot</td>');
	});

	it('processUpdateOwnerFormWithIdMismatch', async () => {
		// The Java test injects an owner with id 2 via flashAttr; here the repository returns it for id 1.
		const repo = new OwnerRepository(t.db);
		const owner = { id: 2, firstName: 'John', lastName: 'Doe', address: 'Center Street', city: 'New York', telephone: '0123456789', pets: [] };
		vi.spyOn(repo, 'findById').mockResolvedValue(owner);
		const save = vi.spyOn(repo, 'save');
		const mismatched = await testApp({ ownerRepository: repo });
		const res = await request(mismatched.app).post('/owners/1/edit');
		expect(res.status).toBe(302);
		expect(res.headers.location).toMatch(/\/owners\/1\/edit$/);
		expect(res.headers['set-cookie']?.[0]).toMatch(/^petclinic\.sid=/);
		expect(save).not.toHaveBeenCalled();
		await mismatched.db.close();
	});
});

/** Field name -> error messages rendered by the inputField fragment. */
function fieldErrors(html: string): Record<string, string[]> {
	const errors: Record<string, string[]> = {};
	const groups = html.split('<div class="form-group').slice(1);
	for (const group of groups) {
		const name = /<input [^>]*name="([^"]+)"/.exec(group)?.[1];
		const messages = /<span class="help-inline">(.*?)<\/span>/.exec(group)?.[1];
		if (name && messages !== undefined) {
			errors[name] = messages.split('<br />');
		}
	}
	return errors;
}
