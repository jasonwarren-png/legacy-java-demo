import { sql, type Kysely, type Transaction } from 'kysely';
import type { Db } from '../db/database.js';
import type { Database } from '../db/schema.js';
import type { Owner, Pet, Visit } from './model.js';

export interface Page<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
}

type OwnerRow = Database['owners'] extends infer T ? { [K in keyof T]: K extends 'id' ? number : T[K] } : never;

/** Port of the Spring Data JPA OwnerRepository: the Owner aggregate with eagerly loaded pets and visits. */
export class OwnerRepository {
	constructor(private readonly db: Db) {}

	private get kysely(): Kysely<Database> {
		return this.db.kysely;
	}

	async findById(id: number): Promise<Owner | undefined> {
		const row = await this.kysely.selectFrom('owners').selectAll().where('id', '=', id).executeTakeFirst();
		return row ? (await this.hydrate([row]))[0] : undefined;
	}

	/** findByLastNameStartingWith(lastName, PageRequest.of(page, size)) */
	async findByLastNameStartingWith(lastName: string, page: number, size: number): Promise<Page<Owner>> {
		// Spring Data escapes LIKE wildcards in the bound value and uses `escape '\'`.
		const pattern = `${lastName.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		const escape = sql.raw(this.db.profile === 'mysql' ? `'\\\\'` : `'\\'`);
		const matches = sql<boolean>`last_name like ${pattern} escape ${escape}`;

		let query = this.kysely.selectFrom('owners').selectAll().where(matches).limit(size).offset(page * size);
		if (this.db.profile === 'sqlite') {
			// The JPA query has no ORDER BY, so row order is whatever the database returns. On the embedded
			// profile H2 walks the last_name index for a non-empty prefix and the primary key otherwise.
			query = lastName === '' ? query.orderBy('id') : query.orderBy('last_name').orderBy('id');
		}
		const rows = await query.execute();
		const { count } = await this.kysely
			.selectFrom('owners')
			.select((eb) => eb.fn.countAll<number | string>().as('count'))
			.where(matches)
			.executeTakeFirstOrThrow();
		const totalElements = Number(count);
		return {
			content: await this.hydrate(rows),
			totalElements,
			totalPages: size === 0 ? 1 : Math.ceil(totalElements / size),
		};
	}

	/** JpaRepository#save with CascadeType.ALL on pets and visits. */
	async save(owner: Owner): Promise<Owner> {
		await this.kysely.transaction().execute(async (trx) => {
			const values = {
				first_name: owner.firstName,
				last_name: owner.lastName,
				address: owner.address,
				city: owner.city,
				telephone: owner.telephone,
			};
			if (owner.id == null) {
				owner.id = await this.insert(trx, 'owners', values);
			}
			else {
				await trx.updateTable('owners').set(values).where('id', '=', owner.id).execute();
			}
			for (const pet of owner.pets) {
				await this.savePet(trx, owner.id, pet);
			}
		});
		return owner;
	}

	private async savePet(trx: Transaction<Database>, ownerId: number, pet: Pet): Promise<void> {
		const values = { name: pet.name, birth_date: pet.birthDate, type_id: pet.type?.id as number, owner_id: ownerId };
		if (pet.id == null) {
			pet.id = await this.insert(trx, 'pets', values);
		}
		else {
			await trx.updateTable('pets').set(values).where('id', '=', pet.id).execute();
		}
		for (const visit of pet.visits) {
			const visitValues = { pet_id: pet.id, visit_date: visit.date, description: visit.description };
			if (visit.id == null) {
				visit.id = await this.insert(trx, 'visits', visitValues);
			}
			else {
				await trx.updateTable('visits').set(visitValues).where('id', '=', visit.id).execute();
			}
		}
	}

	private async insert(trx: Transaction<Database>, table: 'owners' | 'pets' | 'visits', values: object): Promise<number> {
		// The values objects are built per table above; the union of table types can't be expressed generically here.
		const insert = trx.insertInto(table as 'owners').values(values as never);
		if (this.db.profile === 'postgres') {
			const row = await insert.returning('id').executeTakeFirstOrThrow();
			return Number(row.id);
		}
		const result = await insert.executeTakeFirstOrThrow();
		return Number(result.insertId);
	}

	private async hydrate(rows: OwnerRow[]): Promise<Owner[]> {
		if (rows.length === 0) {
			return [];
		}
		const petRows = await this.kysely
			.selectFrom('pets')
			.leftJoin('types', 'types.id', 'pets.type_id')
			.select(['pets.id', 'pets.name', 'pets.birth_date', 'pets.owner_id', 'types.id as type_id', 'types.name as type_name'])
			.where('pets.owner_id', 'in', rows.map((r) => r.id))
			.orderBy('pets.name')
			.execute();
		const visitRows = petRows.length === 0 ? [] : await this.kysely
			.selectFrom('visits')
			.selectAll()
			.where('pet_id', 'in', petRows.map((p) => p.id))
			.orderBy('visit_date', 'asc')
			.execute();

		const visitsByPet = new Map<number, Visit[]>();
		for (const v of visitRows) {
			const list = visitsByPet.get(v.pet_id as number) ?? [];
			list.push({ id: v.id, date: v.visit_date, description: v.description });
			visitsByPet.set(v.pet_id as number, list);
		}
		const petsByOwner = new Map<number, Pet[]>();
		for (const p of petRows) {
			const list = petsByOwner.get(p.owner_id as number) ?? [];
			list.push({
				id: p.id,
				name: p.name,
				birthDate: p.birth_date,
				type: p.type_id == null ? null : { id: p.type_id, name: p.type_name },
				visits: visitsByPet.get(p.id) ?? [],
			});
			petsByOwner.set(p.owner_id as number, list);
		}
		return rows.map((r) => ({
			id: r.id,
			firstName: r.first_name,
			lastName: r.last_name,
			address: r.address,
			city: r.city,
			telephone: r.telephone,
			pets: petsByOwner.get(r.id) ?? [],
		}));
	}
}
