import { existsSync, readFileSync } from 'node:fs';

/** Parses a .properties file with java.util.Properties#load semantics (continuations, \uXXXX escapes, `=`/`:`/space separators). */
export function parseProperties(text: string): Map<string, string> {
	const result = new Map<string, string>();
	const lines = text.split(/\r\n|\r|\n/);
	for (let i = 0; i < lines.length; i++) {
		let line = (lines[i] ?? '').replace(/^[ \t\f]+/, '');
		if (line === '' || line.startsWith('#') || line.startsWith('!')) {
			continue;
		}
		while (endsWithOddBackslashes(line) && i + 1 < lines.length) {
			line = line.slice(0, -1) + (lines[++i] ?? '').replace(/^[ \t\f]+/, '');
		}
		let keyEnd = 0;
		while (keyEnd < line.length) {
			const c = line[keyEnd];
			if (c === '\\') {
				keyEnd += 2;
				continue;
			}
			if (c === '=' || c === ':' || c === ' ' || c === '\t' || c === '\f') {
				break;
			}
			keyEnd++;
		}
		const rawKey = line.slice(0, keyEnd);
		let rest = line.slice(keyEnd).replace(/^[ \t\f]*/, '');
		if (rest.startsWith('=') || rest.startsWith(':')) {
			rest = rest.slice(1).replace(/^[ \t\f]*/, '');
		}
		result.set(unescape(rawKey), unescape(rest));
	}
	return result;
}

function endsWithOddBackslashes(line: string): boolean {
	let count = 0;
	for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) {
		count++;
	}
	return count % 2 === 1;
}

function unescape(value: string): string {
	return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, esc: string) => {
		if (esc.length === 5) {
			return String.fromCharCode(parseInt(esc.slice(1), 16));
		}
		return ({ t: '\t', n: '\n', r: '\r', f: '\f' } as Record<string, string>)[esc] ?? esc;
	});
}

export function loadPropertiesFile(path: string): Map<string, string> | undefined {
	return existsSync(path) ? parseProperties(readFileSync(path, 'utf8')) : undefined;
}
