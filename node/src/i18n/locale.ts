export interface Locale {
	language: string;
	country: string;
}

export const ENGLISH: Locale = { language: 'en', country: '' };

/** Same as Spring's StringUtils.parseLocale: accepts `de`, `pt_BR` or BCP 47 tags like `pt-BR`. */
export function parseLocale(value: string): Locale | undefined {
	const trimmed = value.trim();
	if (trimmed === '') {
		return undefined;
	}
	const [language = '', country = ''] = trimmed.split(trimmed.includes('_') ? '_' : '-');
	return { language: language.toLowerCase(), country: country.toUpperCase() };
}

/** Locale#toLanguageTag, used for the Content-Language header. */
export function languageTag(locale: Locale): string {
	return locale.country ? `${locale.language}-${locale.country}` : locale.language;
}

/** ResourceBundle candidate suffixes, most specific first, then the system locale (en), then the base bundle. */
export function bundleSuffixes(locale: Locale): string[] {
	const suffixes: string[] = [];
	if (locale.country) {
		suffixes.push(`_${locale.language}_${locale.country}`);
	}
	if (locale.language) {
		suffixes.push(`_${locale.language}`);
	}
	suffixes.push('_en', '');
	return [...new Set(suffixes)];
}
