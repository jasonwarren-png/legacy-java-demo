import type { Locale } from '../i18n/locale.js';
import { messages, validationMessages } from '../i18n/index.js';
import type { Errors } from './errors.js';
import { javaTrim } from './javaText.js';

/** A Jakarta Bean Validation constraint (only the ones the domain uses). */
export interface Constraint {
	code: 'NotBlank' | 'Size' | 'Pattern';
	messageTemplate: string;
	attributes: Record<string, string | number>;
	isValid(value: string | null | undefined): boolean;
}

export const notBlank = (): Constraint => ({
	code: 'NotBlank',
	messageTemplate: '{jakarta.validation.constraints.NotBlank.message}',
	attributes: {},
	isValid: (value) => value != null && javaTrim(value).length > 0,
});

export const size = (max: number, min = 0): Constraint => ({
	code: 'Size',
	messageTemplate: '{jakarta.validation.constraints.Size.message}',
	attributes: { min, max },
	isValid: (value) => value == null || (value.length >= min && value.length <= max),
});

export const pattern = (regexp: string, messageTemplate = '{jakarta.validation.constraints.Pattern.message}'): Constraint => {
	const compiled = new RegExp(`^(?:${regexp})$`);
	return {
		code: 'Pattern',
		messageTemplate,
		attributes: { regexp },
		isValid: (value) => value == null || compiled.test(value),
	};
};

/**
 * Spring Boot's MessageSourceMessageInterpolator + Hibernate Validator: `{key}` is resolved from the app's
 * messages, then from ValidationMessages, then from the constraint attributes.
 */
export function interpolate(template: string, attributes: Record<string, string | number>, locale: Locale, depth = 0): string {
	return template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
		if (depth > 5) {
			return match;
		}
		const fromMessages = messages.find(key, locale) ?? validationMessages.find(key, locale);
		if (fromMessages !== undefined) {
			return interpolate(fromMessages, attributes, locale, depth + 1);
		}
		return key in attributes ? String(attributes[key]) : match;
	});
}

export type ConstraintMap<T> = { [K in keyof T]?: Constraint[] };

/**
 * Validates `target` and records violations in `errors`. Hibernate Validator reports multiple violations of one
 * field in HashSet order (varies between requests); here they follow declaration order.
 */
export function validate<T extends object>(target: T, constraints: ConstraintMap<T>, errors: Errors, locale: Locale): void {
	for (const [field, fieldConstraints] of Object.entries(constraints) as [string, Constraint[]][]) {
		const value = (target as Record<string, unknown>)[field] as string | null | undefined;
		for (const constraint of fieldConstraints) {
			if (!constraint.isValid(value)) {
				errors.rejectValue(field, constraint.code, interpolate(constraint.messageTemplate, constraint.attributes, locale));
			}
		}
	}
}
