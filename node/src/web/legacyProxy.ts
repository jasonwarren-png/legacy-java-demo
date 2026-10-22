import { posix } from 'node:path';

/** Only the health and info actuator endpoints stay reachable through Node (plan decision D3). */
const ALLOWED_ACTUATOR_PATH = /^\/actuator\/(?:health(?:\/.*)?|info)$/;

/**
 * Whether a request path may be forwarded to the legacy Spring app. The path is normalized the way
 * Tomcat/Spring would see it (percent-decoding, matrix parameters, duplicate slashes, dot segments)
 * so encoded or traversal variants of blocked actuator paths cannot slip through.
 */
export function isProxiedToLegacy(rawPath: string): boolean {
	let path: string;
	try {
		path = decodeURIComponent(rawPath.split('?')[0] ?? '');
	} catch {
		return false;
	}
	if (path.includes('\\') || path.includes('\0')) {
		return false;
	}
	path = posix.normalize(path.replace(/;[^/]*/g, '')).replace(/\/+$/, '') || '/';
	const lower = path.toLowerCase();
	if (lower === '/actuator' || lower.startsWith('/actuator/')) {
		return ALLOWED_ACTUATOR_PATH.test(path);
	}
	return true;
}
