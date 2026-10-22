import type { Locale } from '../i18n/locale.js';
import { messages } from '../i18n/index.js';

export interface FieldError {
	field: string;
	code: string;
	message: string;
}

/** Minimal Spring BindingResult: field errors whose message is resolved like Spring's DefaultMessageCodesResolver. */
export class Errors {
	readonly fieldErrors: FieldError[] = [];

	constructor(
		private readonly objectName: string,
		private readonly locale: Locale,
	) {}

	rejectValue(field: string, code: string, defaultMessage: string): void {
		const codes = [`${code}.${this.objectName}.${field}`, `${code}.${field}`, `${code}.java.lang.String`, code];
		const resolved = codes.map((c) => messages.find(c, this.locale)).find((m) => m !== undefined);
		this.fieldErrors.push({ field, code, message: resolved ?? defaultMessage });
	}

	hasErrors(): boolean {
		return this.fieldErrors.length > 0;
	}

	hasFieldErrors(field: string): boolean {
		return this.fieldErrors.some((e) => e.field === field);
	}

	messagesFor(field: string): string[] {
		return this.fieldErrors.filter((e) => e.field === field).map((e) => e.message);
	}

	allMessages(): string[] {
		return this.fieldErrors.map((e) => e.message);
	}
}
