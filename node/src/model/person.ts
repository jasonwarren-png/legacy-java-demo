import { notBlank, size, type ConstraintMap } from '../validation/constraints.js';

export interface BaseEntity {
	id?: number;
}

export interface Person extends BaseEntity {
	firstName: string | null;
	lastName: string | null;
}

export function isNew(entity: BaseEntity): boolean {
	return entity.id === undefined || entity.id === null;
}

/** Person: @Size(max = 30) @NotBlank on firstName and lastName. */
export const personConstraints: ConstraintMap<Person> = {
	firstName: [size(30), notBlank()],
	lastName: [size(30), notBlank()],
};
