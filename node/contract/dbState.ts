import { createConnection } from 'mysql2/promise';
import pg from 'pg';

export interface DbState {
	owners: unknown[];
	pets: unknown[];
	visits: unknown[];
}

const QUERIES = {
	owners: 'SELECT id, first_name, last_name, address, city, telephone FROM owners ORDER BY id',
	pets: 'SELECT id, name, CAST(birth_date AS CHAR(10)) AS birth_date, type_id, owner_id FROM pets ORDER BY id',
	visits: 'SELECT id, pet_id, CAST(visit_date AS CHAR(10)) AS visit_date, description FROM visits ORDER BY id',
};

/** Reads the aggregate tables; `url` is postgres://user:pass@host:port/db or mysql://user:pass@host:port/db. */
export async function dumpDatabase(url: string): Promise<DbState> {
	if (url.startsWith('mysql:')) {
		const conn = await createConnection({ uri: url, dateStrings: true });
		try {
			const read = async (q: string) => (await conn.query(q))[0] as unknown[];
			return { owners: await read(QUERIES.owners), pets: await read(QUERIES.pets), visits: await read(QUERIES.visits) };
		}
		finally {
			await conn.end();
		}
	}
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		const read = async (q: string) => (await client.query(q.replace(/CHAR\(10\)/g, 'VARCHAR(10)'))).rows;
		return { owners: await read(QUERIES.owners), pets: await read(QUERIES.pets), visits: await read(QUERIES.visits) };
	}
	finally {
		await client.end();
	}
}
