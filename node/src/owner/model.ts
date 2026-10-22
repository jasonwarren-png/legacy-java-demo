import { isNew, personConstraints, type BaseEntity, type Person } from '../model/person.js';
import { notBlank, pattern, size, type ConstraintMap } from '../validation/constraints.js';

export interface PetType extends BaseEntity {
	name: string | null;
}

export interface Visit extends BaseEntity {
	/** yyyy-MM-dd */
	date: string | null;
	description: string | null;
}

export interface Pet extends BaseEntity {
	name: string | null;
	birthDate: string | null;
	type: PetType | null;
	/** Ordered by date ascending. */
	visits: Visit[];
}

export interface Owner extends Person {
	address: string | null;
	city: string | null;
	telephone: string | null;
	/** Ordered by name. */
	pets: Pet[];
}

export const OWNER_FIELDS = ['firstName', 'lastName', 'address', 'city', 'telephone'] as const;

export const ownerConstraints: ConstraintMap<Owner> = {
	...personConstraints,
	address: [notBlank(), size(255)],
	city: [notBlank(), size(80)],
	telephone: [notBlank(), pattern('\\d{10}', '{telephone.invalid}')],
};

export function newOwner(): Owner {
	return { firstName: null, lastName: null, address: null, city: null, telephone: null, pets: [] };
}

/** NamedEntity#toString */
export function namedToString(entity: { name: string | null } | null | undefined): string {
	return entity?.name ?? '<null>';
}

export function addPet(owner: Owner, pet: Pet | null | undefined): void {
	if (!pet || owner.pets.includes(pet)) {
		return;
	}
	if (!isNew(pet) && owner.pets.some((existing) => !isNew(existing) && existing.id === pet.id)) {
		return;
	}
	owner.pets.push(pet);
}

export function getPetById(owner: Owner, id: number): Pet | undefined {
	return owner.pets.find((pet) => !isNew(pet) && pet.id === id);
}

/** Owner#getPet(String, boolean): case-insensitive name lookup, optionally skipping unsaved pets. */
export function getPetByName(owner: Owner, name: string, ignoreNew = false): Pet | undefined {
	const lower = name.toLowerCase();
	return owner.pets.find((pet) => pet.name != null && pet.name.toLowerCase() === lower && (!ignoreNew || !isNew(pet)));
}

export function addVisit(owner: Owner, petId: number, visit: Visit): void {
	const pet = getPetById(owner, petId);
	if (!pet) {
		throw new Error('Invalid Pet identifier!');
	}
	pet.visits.push(visit);
}
