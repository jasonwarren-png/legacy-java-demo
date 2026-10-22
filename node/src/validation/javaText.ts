/** Character.isWhitespace (excludes the non-breaking spaces U+00A0, U+2007, U+202F). */
const JAVA_WHITESPACE = '\\t\\n\\u000B\\f\\r\\u001C-\\u001F \\u1680\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000';
const STRIP = new RegExp(`^[${JAVA_WHITESPACE}]+|[${JAVA_WHITESPACE}]+$`, 'g');
const ALL_WHITESPACE = new RegExp(`[${JAVA_WHITESPACE}]`, 'g');

/** String#trim: removes leading/trailing chars <= U+0020 (what @NotBlank uses). */
export function javaTrim(value: string): string {
	let start = 0;
	let end = value.length;
	while (start < end && value.charCodeAt(start) <= 0x20) start++;
	while (end > start && value.charCodeAt(end - 1) <= 0x20) end--;
	return value.slice(start, end);
}

/** String#strip: removes leading/trailing Character.isWhitespace chars. */
export function javaStrip(value: string): string {
	return value.replace(STRIP, '');
}

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

/**
 * Spring's String -> Integer conversion (NumberUtils.parseNumber): strips all whitespace, decodes 0x/# hex,
 * otherwise Integer.valueOf. Returns undefined where Spring would throw (a 400 for request parameters).
 */
export function parseJavaInt(text: string): number | undefined {
	const trimmed = text.replace(ALL_WHITESPACE, '');
	let value: number;
	const hex = /^([-+]?)(?:0[xX]|#)([0-9a-fA-F]+)$/.exec(trimmed);
	if (hex) {
		value = parseInt(hex[2] ?? '', 16) * (hex[1] === '-' ? -1 : 1);
	}
	else if (/^[-+]?\d+$/.test(trimmed)) {
		value = Number(trimmed);
	}
	else {
		return undefined;
	}
	return value >= INT_MIN && value <= INT_MAX ? value : undefined;
}

/** UriUtils.encode: percent-encodes everything except RFC 3986 unreserved characters. */
export function encodeUriStrict(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** java.net.URLEncoder.encode (UTF-8): keeps a-z A-Z 0-9 . - * _, encodes space as `+`. */
export function encodeFormComponent(value: string): string {
	return encodeURIComponent(value)
		.replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
		.replace(/%20/g, '+');
}
