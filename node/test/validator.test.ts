// Port of src/test/java/.../model/ValidatorTests.java
import { describe, expect, it } from 'vitest';
import { ENGLISH } from '../src/i18n/locale.js';
import { personConstraints, type Person } from '../src/model/person.js';
import { validate } from '../src/validation/constraints.js';
import { Errors } from '../src/validation/errors.js';

function violations(person: Person) {
	const errors = new Errors('person', ENGLISH);
	validate(person, personConstraints, errors, ENGLISH);
	return errors.fieldErrors;
}

describe('Validator', () => {
	it('shouldNotValidateWhenFirstNameEmpty', () => {
		const [violation, ...rest] = violations({ firstName: '', lastName: 'smith' });
		expect(rest).toHaveLength(0);
		expect(violation?.field).toBe('firstName');
		expect(violation?.message).toBe('must not be blank');
	});

	it('shouldNotValidateWhenLastNameEmpty', () => {
		const [violation, ...rest] = violations({ firstName: 'George', lastName: '' });
		expect(rest).toHaveLength(0);
		expect(violation?.field).toBe('lastName');
		expect(violation?.message).toBe('must not be blank');
	});
});
