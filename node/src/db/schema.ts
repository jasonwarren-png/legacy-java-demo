import type { Generated } from 'kysely';

export interface OwnersTable {
	id: Generated<number>;
	first_name: string | null;
	last_name: string | null;
	address: string | null;
	city: string | null;
	telephone: string | null;
}

export interface PetsTable {
	id: Generated<number>;
	name: string | null;
	/** ISO yyyy-MM-dd; every driver is configured to return DATE columns as strings. */
	birth_date: string | null;
	type_id: number;
	owner_id: number | null;
}

export interface VisitsTable {
	id: Generated<number>;
	pet_id: number | null;
	visit_date: string | null;
	description: string | null;
}

export interface TypesTable {
	id: Generated<number>;
	name: string | null;
}

export interface Database {
	owners: OwnersTable;
	pets: PetsTable;
	visits: VisitsTable;
	types: TypesTable;
}
