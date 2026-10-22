import type { ContractRequest } from './http.js';

export interface Scenario {
	name: string;
	request: ContractRequest;
	/** Start from a new browser session (no cookies) on both apps. */
	freshSession?: boolean;
}

const HTML = { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };
const LOCALES = ['en', 'de', 'es', 'fa', 'hi', 'ja', 'ko', 'pt', 'ru', 'tr', 'pt_BR', 'pt-BR', 'fr', 'xx-YY'];
const spaces = (n: number) => ' '.repeat(n);
const validOwner = (overrides: Record<string, string> = {}): [string, string][] =>
	Object.entries({ firstName: 'Joe', lastName: 'Bloggs', address: '123 Caramel Street', city: 'London', telephone: '1316761638', ...overrides });

/**
 * Requests replayed in order against both apps. Writes happen in the same order on both sides, so generated ids
 * and later reads line up. Names prefixed with a Java test name mirror that JUnit test over HTTP.
 */
export const scenarios: Scenario[] = [
	// --- Read-only pages -------------------------------------------------------------------------------------
	{ name: 'initCreationForm: GET /owners/new', request: { path: '/owners/new' } },
	{ name: 'initFindForm: GET /owners/find', request: { path: '/owners/find' } },
	{ name: 'processFindFormSuccess: list page 1', request: { path: '/owners?page=1' } },
	{ name: 'list, empty lastName', request: { path: '/owners?lastName=' } },
	{ name: 'list page 2', request: { path: '/owners?page=2' } },
	{ name: 'list, no params', request: { path: '/owners' } },
	{ name: 'search Davis (2 results)', request: { path: '/owners?lastName=Davis' } },
	{ name: 'search lowercase prefix "davis"', request: { path: '/owners?lastName=davis' } },
	{ name: 'search prefix "E"', request: { path: '/owners?lastName=E' } },
	{ name: 'processFindFormByLastName: Franklin redirects to owner', request: { path: '/owners?page=1&lastName=Franklin' } },
	{ name: 'processFindFormIgnoresSurroundingWhitespace: " Franklin "', request: { path: '/owners?page=1&lastName=%20Franklin%20' } },
	{ name: 'search with tab/newline whitespace', request: { path: '/owners?lastName=%09Franklin%0A' } },
	{ name: 'processFindFormWithWhitespaceOnlyLastNameReturnsAllOwners', request: { path: '/owners?page=1&lastName=%20%20%20' } },
	{ name: 'processFindFormNoOwnersFound', request: { path: '/owners?page=1&lastName=Unknown%20Surname' } },
	{ name: 'search LIKE wildcard "%" is escaped', request: { path: '/owners?lastName=%25' } },
	{ name: 'search LIKE wildcard "_avis" is escaped', request: { path: '/owners?lastName=_avis' } },
	{ name: 'search backslash', request: { path: '/owners?lastName=%5C' } },
	{ name: 'search with HTML in lastName is escaped', request: { path: '/owners?lastName=%3Cscript%3E%22x%27' } },
	{ name: 'processFindFormRedirectsOutOfBoundsPageToFirstPage: page=0', request: { path: '/owners?page=0&lastName=Franklin' } },
	{ name: 'processFindFormRedirectsOutOfBoundsPageToFirstPage: page=2', request: { path: '/owners?page=2&lastName=Franklin' } },
	{ name: 'out-of-bounds page keeps stripped, encoded lastName', request: { path: '/owners?page=9&lastName=%20Da%20vis%27%20' } },
	{ name: 'out-of-bounds page, no lastName', request: { path: '/owners?page=99' } },
	{ name: 'negative page', request: { path: '/owners?page=-1' } },
	{ name: 'page empty uses default', request: { path: '/owners?page=' } },
	{ name: 'page with surrounding spaces', request: { path: '/owners?page=%202%20' } },
	{ name: 'page given twice uses first', request: { path: '/owners?page=2&page=1' } },
	{ name: 'page as hex', request: { path: '/owners?page=0x2' } },
	{ name: 'page not a number -> 400 JSON', request: { path: '/owners?page=abc' } },
	{ name: 'page not a number -> 400 HTML', request: { path: '/owners?page=abc', headers: HTML } },
	{ name: 'page int overflow -> 400', request: { path: '/owners?page=99999999999' } },
	{ name: 'page decimal -> 400', request: { path: '/owners?page=1.5' } },
	{ name: 'showOwner: owner 1', request: { path: '/owners/1' } },
	{ name: 'showOwner: owner 6 (pets ordered by name, visits by date)', request: { path: '/owners/6' } },
	{ name: 'showOwner: owner 10', request: { path: '/owners/10' } },
	{ name: 'showOwner: hex id', request: { path: '/owners/0x3' } },
	{ name: 'showOwner: matrix/jsessionid path params ignored', request: { path: '/owners/2;jsessionid=ABC123' } },
	{ name: 'showOwner: unknown id -> 500 JSON', request: { path: '/owners/999' } },
	{ name: 'showOwner: unknown id -> 500 HTML', request: { path: '/owners/999', headers: HTML } },
	{ name: 'showOwner: negative id -> 500', request: { path: '/owners/-1' } },
	{ name: 'showOwner: non-numeric id -> 400', request: { path: '/owners/abc' } },
	{ name: 'showOwner: id overflow -> 400', request: { path: '/owners/2147483648' } },
	{ name: 'trailing slash /owners/ -> 404 JSON', request: { path: '/owners/' } },
	{ name: 'trailing slash /owners/1/ -> 404 HTML', request: { path: '/owners/1/', headers: HTML } },
	{ name: 'initUpdateOwnerForm: owner 1', request: { path: '/owners/1/edit' } },
	{ name: 'initUpdateOwnerForm: unknown owner -> 500', request: { path: '/owners/999/edit', headers: HTML } },
	{ name: 'initUpdateOwnerForm: non-numeric id -> 400', request: { path: '/owners/x/edit' } },

	// --- HTTP method handling -------------------------------------------------------------------------------
	{ name: 'PUT /owners/new -> 405', request: { method: 'PUT', path: '/owners/new' } },
	{ name: 'DELETE /owners/1 -> 405 HTML', request: { method: 'DELETE', path: '/owners/1', headers: HTML } },
	{ name: 'POST /owners/find -> 405', request: { method: 'POST', path: '/owners/find' } },
	{ name: 'POST /owners -> 405', request: { method: 'POST', path: '/owners' } },
	{ name: 'PATCH /owners/1/edit -> 405', request: { method: 'PATCH', path: '/owners/1/edit' } },
	{ name: 'OPTIONS /owners/new', request: { method: 'OPTIONS', path: '/owners/new' } },
	{ name: 'OPTIONS /owners/1', request: { method: 'OPTIONS', path: '/owners/1' } },
	{ name: 'HEAD /owners/1', request: { method: 'HEAD', path: '/owners/1' } },

	// --- Create owner: validation ---------------------------------------------------------------------------
	{ name: 'processCreationFormHasErrors', request: { method: 'POST', path: '/owners/new', form: [['firstName', 'Joe'], ['lastName', 'Bloggs'], ['city', 'London']] } },
	{ name: 'processCreationFormRejectsCityLongerThanColumn', request: { method: 'POST', path: '/owners/new', form: validOwner({ city: 'C'.repeat(81) }) } },
	{ name: 'processCreationFormRejectsAddressLongerThanColumn', request: { method: 'POST', path: '/owners/new', form: validOwner({ address: 'A'.repeat(256) }) } },
	{ name: 'create: names longer than 30', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: 'F'.repeat(31), lastName: 'L'.repeat(31) }) } },
	{ name: 'create: boundary lengths are valid except telephone', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: 'F'.repeat(30), lastName: 'L'.repeat(30), address: 'A'.repeat(255), city: 'C'.repeat(80), telephone: '12345678901' }) } },
	{ name: 'create: whitespace-only fields (two violations per field)', request: { method: 'POST', path: '/owners/new', form: [['firstName', spaces(31)], ['lastName', spaces(31)], ['address', spaces(256)], ['city', spaces(81)], ['telephone', spaces(21)]] } },
	{ name: 'create: non-breaking space is not blank for @NotBlank', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: '\u00a0', telephone: 'abcdefghij' }) } },
	{ name: 'create: unicode digits are not \\d', request: { method: 'POST', path: '/owners/new', form: validOwner({ telephone: '١٢٣٤٥٦٧٨٩٠' }) } },
	{ name: 'create: telephone with newline', request: { method: 'POST', path: '/owners/new', form: validOwner({ telephone: '1234567890\n' }) } },
	{ name: 'create: repeated params are comma-joined, query + body, HTML escaped', request: { method: 'POST', path: '/owners/new?firstName=Q', form: [['firstName', '<b>"O\'Br&en"</b>'], ['lastName', 'a'], ['lastName', 'b'], ['telephone', '1']] } },
	{ name: 'create: JSON body binds nothing', request: { method: 'POST', path: '/owners/new', headers: { 'content-type': 'application/json' }, body: '{"firstName":"x"}' } },
	{ name: 'create: no body', request: { method: 'POST', path: '/owners/new' } },
	...LOCALES.map((lang): Scenario => ({
		name: `create: all fields invalid, lang=${lang}`,
		freshSession: true,
		request: { method: 'POST', path: `/owners/new?lang=${lang}`, form: [['firstName', ''], ['lastName', 'L'.repeat(31)], ['address', ''], ['city', 'C'.repeat(81)], ['telephone', '12ab']] },
	})),

	// --- Locale is kept in the session ----------------------------------------------------------------------
	{ name: 'locale: ?lang=de sets session locale', freshSession: true, request: { path: '/owners/find?lang=de' } },
	{ name: 'locale: next request keeps de', request: { path: '/owners?lastName=Unknown' } },
	{ name: 'locale: error page uses session locale', request: { path: '/owners/999', headers: HTML } },
	{ name: 'locale: ?lang= resets to default', request: { path: '/owners/find?lang=' } },
	{ name: 'locale: back to en', request: { path: '/owners/find' } },
	{ name: 'locale: empty lang without a session creates none', freshSession: true, request: { path: '/owners/find?lang=' } },

	// --- Create owner: success + flash ----------------------------------------------------------------------
	{ name: 'processCreationFormSuccess: creates owner 11, ignores id param', freshSession: true, request: { method: 'POST', path: '/owners/new', form: [...validOwner(), ['id', '77']] } },
	{ name: 'flash: owner 11 shows "New Owner Created"', request: { path: '/owners/11' } },
	{ name: 'flash: consumed after one view', request: { path: '/owners/11' } },
	{ name: 'create owner 12 "Dab" (sorts before Davis)', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: 'Dee', lastName: 'Dab' }) } },
	{ name: 'flash: survives requests to other pages', request: { path: '/owners/find' } },
	{ name: 'flash: still shown on target page', request: { path: '/owners/12' } },
	{ name: 'search "Da": result order', request: { path: '/owners?lastName=Da' } },
	{ name: 'search "" page 3 after inserts', request: { path: '/owners?page=3' } },
	{ name: 'create owner 13 with HTML special characters', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: '<b>"Bob" & co</b>', lastName: "O'Brien", address: '1 < 2 > 0', city: 'Q&A' }) } },
	{ name: 'owner 13 details are escaped', request: { path: '/owners/13' } },
	{ name: 'search "O\'" finds owner 13', request: { path: "/owners?lastName=O'" } },
	{ name: 'create owner 14 with non-ASCII names', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: 'Jürgen', lastName: 'Ünal', city: 'Zürich' }) } },
	{ name: 'owner 14 details', request: { path: '/owners/14' } },
	{ name: 'search exact-case "Ü"', request: { path: '/owners?lastName=%C3%9C' } },
	{ name: 'search lowercase non-ASCII "ü"', request: { path: '/owners?lastName=%C3%BC' } },
	{ name: 'create owner 15 "Davis" (third Davis)', request: { method: 'POST', path: '/owners/new', form: validOwner({ firstName: 'Dan', lastName: 'Davis' }) } },
	{ name: 'search Davis now lists 3', request: { path: '/owners?lastName=Davis' } },
	{ name: 'list page 3 after all inserts', request: { path: '/owners?lastName=&page=3' } },
	{ name: 'list page 4 is out of bounds', request: { path: '/owners?lastName=&page=4' } },

	// --- Update owner -----------------------------------------------------------------------------------------
	{ name: 'processUpdateOwnerFormSuccess', freshSession: true, request: { method: 'POST', path: '/owners/11/edit', form: validOwner({ city: 'Paris', telephone: '1616291589' }) } },
	{ name: 'flash: "Owner Values Updated"', request: { path: '/owners/11' } },
	{ name: 'processUpdateOwnerFormUnchangedSuccess', request: { method: 'POST', path: '/owners/11/edit' } },
	{ name: 'update: owner 11 unchanged', request: { path: '/owners/11/edit' } },
	{ name: 'processUpdateOwnerFormHasErrors', request: { method: 'POST', path: '/owners/11/edit', form: [['firstName', 'Joe'], ['lastName', 'Bloggs'], ['address', ''], ['telephone', '']] } },
	{ name: 'update: partial form only changes given fields', request: { method: 'POST', path: '/owners/12/edit', form: [['city', 'Rome']] } },
	{ name: 'update: owner 12 after partial update', request: { path: '/owners/12' } },
	{ name: 'update: id in the form is ignored (no id mismatch possible)', request: { method: 'POST', path: '/owners/3/edit', form: [...validOwner({ firstName: 'Eddie', lastName: 'Rodriquez' }), ['id', '4']] } },
	{ name: 'update: owner 3 updated, owner 4 untouched', request: { path: '/owners/3' } },
	{ name: 'update: owner 4', request: { path: '/owners/4' } },
	{ name: 'update: via hex id redirects to raw path variable', request: { method: 'POST', path: '/owners/0x5/edit', form: validOwner({ firstName: 'Pete', lastName: 'McTavish' }) } },
	{ name: 'update: flash on the raw path', request: { path: '/owners/0x5' } },
	{ name: 'update: owner with pets keeps pets', request: { path: '/owners/5' } },
	{ name: 'update: unknown owner -> 500', request: { method: 'POST', path: '/owners/999/edit', form: validOwner() } },
	{ name: 'update: non-numeric id -> 400', request: { method: 'POST', path: '/owners/abc/edit', form: validOwner() } },
	{ name: 'update: lang=ja validation errors', freshSession: true, request: { method: 'POST', path: '/owners/1/edit?lang=ja', form: [['firstName', ''], ['telephone', '123']] } },

	// --- Final state, read back over HTTP ---------------------------------------------------------------------
	...[1, 2, 3].map((page): Scenario => ({ name: `final state: list page ${page}`, freshSession: true, request: { path: `/owners?lastName=&page=${page}` } })),
	...[11, 12, 13, 14, 15].map((id): Scenario => ({ name: `final state: owner ${id}`, request: { path: `/owners/${id}` } })),
];
