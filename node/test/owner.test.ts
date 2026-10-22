// Port of src/test/java/.../owner/OwnerTests.java
import { describe, expect, it } from 'vitest';
import { addPet, newOwner, type Pet } from '../src/owner/model.js';

const buddy = (): Pet => ({ id: 5, name: 'Buddy', birthDate: null, type: null, visits: [] });

describe('Owner', () => {
	it('addPetAddsPersistedPet', () => {
		const owner = newOwner();
		const pet = buddy();
		addPet(owner, pet);
		expect(owner.pets).toContain(pet);
		expect(owner.pets).toHaveLength(1);
	});

	it('addPetDoesNotAddDuplicatePet', () => {
		const owner = newOwner();
		const pet = buddy();
		addPet(owner, pet);
		addPet(owner, pet);
		expect(owner.pets).toHaveLength(1);
	});
});
