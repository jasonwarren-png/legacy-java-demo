// Differential contract tests: every scenario is sent to the Spring app and to the Node app, and the normalized
// responses must be identical. After the run, the database contents of both apps are compared too (Postgres/MySQL).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { dumpDatabase } from './dbState.js';
import { AppClient } from './http.js';
import { normalize, type NormalizedResponse } from './normalize.js';
import { scenarios } from './scenarios.js';

const javaUrl = process.env.JAVA_BASE_URL;
const nodeUrl = process.env.NODE_BASE_URL;
const profile = process.env.CONTRACT_PROFILE ?? 'h2';
const resultsDir = resolve(dirname(fileURLToPath(import.meta.url)), 'results');

interface Result {
	name: string;
	request: string;
	java: number;
	node: number;
	match: boolean;
}

const results: Result[] = [];
const mismatches: { name: string; java: NormalizedResponse; node: NormalizedResponse }[] = [];

describe.runIf(javaUrl && nodeUrl)(`Owners API contract: Java vs Node (${profile})`, () => {
	const java = new AppClient('java', javaUrl ?? '');
	const node = new AppClient('node', nodeUrl ?? '');

	for (const scenario of scenarios) {
		it(scenario.name, async () => {
			if (scenario.freshSession) {
				java.clearCookies();
				node.clearCookies();
			}
			const expected: NormalizedResponse = normalize(await java.send(scenario.request));
			const actual: NormalizedResponse = normalize(await node.send(scenario.request));
			const match = isDeepStrictEqual(expected, actual);
			results.push({
				name: scenario.name,
				request: `${scenario.request.method ?? 'GET'} ${scenario.request.path}`,
				java: expected.status,
				node: actual.status,
				match,
			});
			if (!match) {
				mismatches.push({ name: scenario.name, java: expected, node: actual });
			}
			expect(actual).toEqual(expected);
		});
	}

	it.runIf(process.env.JAVA_DB_URL && process.env.NODE_DB_URL)('database state: owners, pets, visits rows are identical', async () => {
		const [javaRows, nodeRows] = await Promise.all([
			dumpDatabase(process.env.JAVA_DB_URL ?? ''),
			dumpDatabase(process.env.NODE_DB_URL ?? ''),
		]);
		const match = isDeepStrictEqual(javaRows, nodeRows);
		results.push({ name: 'database state: owners, pets, visits rows are identical', request: 'SQL dump', java: javaRows.owners.length, node: nodeRows.owners.length, match });
		expect(nodeRows).toEqual(javaRows);
	});

	afterAll(() => {
		mkdirSync(resultsDir, { recursive: true });
		const passed = results.filter((r) => r.match).length;
		const lines = [
			`# Owners contract results: ${profile}`,
			'',
			`${passed}/${results.length} scenarios identical (Java ${javaUrl} vs Node ${nodeUrl}).`,
			'',
			'| # | Scenario | Request | Java | Node | Result |',
			'|---|---|---|---|---|---|',
			...results.map((r, i) => `| ${i + 1} | ${r.name.replace(/\|/g, '\\|')} | \`${r.request.replace(/\|/g, '\\|')}\` | ${r.java} | ${r.node} | ${r.match ? 'match' : '**MISMATCH**'} |`),
			'',
		];
		writeFileSync(resolve(resultsDir, `${profile}.md`), lines.join('\n'));
		const mismatchFile = resolve(resultsDir, `${profile}-mismatches.json`);
		if (mismatches.length > 0) {
			writeFileSync(mismatchFile, JSON.stringify(mismatches, null, 2));
		}
		else {
			rmSync(mismatchFile, { force: true });
		}
	});
});
