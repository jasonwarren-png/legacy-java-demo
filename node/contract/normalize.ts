import type { ContractResponse } from './http.js';

/**
 * The comparable view of a response. Differences that are not behavior are normalized away, each for a stated
 * reason; everything else (status, routing headers, body) must match exactly.
 */
export interface NormalizedResponse {
	status: number;
	headers: Record<string, string>;
	body: unknown;
}

/** Headers that define behavior. Date, Transfer-Encoding, Content-Length, Connection, Keep-Alive are transport. */
const COMPARED_HEADERS = ['content-type', 'content-language', 'location', 'allow', 'cache-control'];

export function normalize(res: ContractResponse): NormalizedResponse {
	const headers: Record<string, string> = {};
	for (const name of COMPARED_HEADERS) {
		const value = res.headers.get(name);
		if (value !== null) {
			headers[name] = name === 'location' ? normalizeLocation(value) : name === 'allow' ? sortAllow(value) : value;
		}
	}
	// Session cookie names/values differ by design (JSESSIONID vs petclinic.sid, so both can coexist behind the
	// strangler proxy); compare whether a session cookie was issued and its attributes.
	const setCookie = res.headers.getSetCookie();
	if (setCookie.length > 0) {
		headers['set-cookie'] = setCookie.map((c) => c.split(';').slice(1).map((a) => a.trim()).join('; ')).join(' | ');
	}
	return { status: res.status, headers, body: normalizeBody(res) };
}

/** Spring builds the 405 Allow list from a set whose order varies between JVM runs (`GET, POST` or `POST, GET`). */
function sortAllow(value: string): string {
	const separator = value.includes(', ') ? ', ' : ',';
	return value.split(separator).sort().join(separator);
}

/**
 * Locations are compared without scheme/host (each app builds them from its own Host header) and without the
 * `;jsessionid=` URL rewriting Tomcat adds when it creates a session during a redirect.
 */
function normalizeLocation(location: string): string {
	return stripJsessionid(location.replace(/^https?:\/\/[^/]+/, ''));
}

/**
 * Tomcat appends `;jsessionid=<id>` to every Thymeleaf link (and redirect) in the response that creates a session,
 * because it doesn't know yet whether the browser accepts cookies. The Node app tracks sessions by cookie only.
 */
function stripJsessionid(text: string): string {
	return text.replace(/;jsessionid=[0-9A-Za-z._-]+/gi, '');
}

function normalizeBody(res: ContractResponse): unknown {
	const type = res.headers.get('content-type') ?? '';
	if (type.startsWith('application/json')) {
		const json = JSON.parse(res.body) as Record<string, unknown>;
		if (typeof json.timestamp === 'string' && !Number.isNaN(Date.parse(json.timestamp))) {
			json.timestamp = '<ISO-8601 timestamp>';
		}
		return json;
	}
	if (type.startsWith('text/html')) {
		return normalizeHtml(res.body);
	}
	return res.body;
}

/**
 * Insignificant whitespace (indentation, blank lines left by Thymeleaf attribute processors, space before `>`) is
 * collapsed, and `;jsessionid=` URL rewriting is removed (see stripJsessionid). Hibernate Validator returns multiple violations of one field in HashSet order, which varies between
 * requests on the Java side, so the messages inside one `help-inline` span are compared as a sorted list.
 */
export function normalizeHtml(html: string): string {
	return stripJsessionid(html)
		.replace(/\s+/g, ' ')
		.replace(/>\s+</g, '><')
		.replace(/\s+>/g, '>')
		.replace(/\s+\/>/g, '/>')
		.replace(/(<span class="help-inline">)(.*?)(<\/span>)/g, (_m, open: string, messages: string, close: string) =>
			open + messages.split('<br/>').sort().join('<br/>') + close)
		.trim();
}
