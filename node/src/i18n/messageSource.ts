import { resolve } from 'node:path';
import { bundleSuffixes, type Locale } from './locale.js';
import { loadPropertiesFile } from './properties.js';

/** Equivalent of a Spring ResourceBundleMessageSource / JDK ResourceBundle family loaded from `<dir>/<basename>_xx.properties`. */
export class MessageSource {
	private readonly bundles = new Map<string, Map<string, string> | undefined>();

	constructor(
		private readonly dir: string,
		private readonly basename: string,
	) {}

	private bundle(suffix: string): Map<string, string> | undefined {
		if (!this.bundles.has(suffix)) {
			this.bundles.set(suffix, loadPropertiesFile(resolve(this.dir, `${this.basename}${suffix}.properties`)));
		}
		return this.bundles.get(suffix);
	}

	find(code: string, locale: Locale): string | undefined {
		for (const suffix of bundleSuffixes(locale)) {
			const value = this.bundle(suffix)?.get(code);
			if (value !== undefined) {
				return value;
			}
		}
		return undefined;
	}

	/** Thymeleaf `#{code}`: unresolvable keys render as `??code_locale??`. */
	get(code: string, locale: Locale): string {
		const localeName = locale.country ? `${locale.language}_${locale.country}` : locale.language;
		return this.find(code, locale) ?? `??${code}_${localeName}??`;
	}
}
