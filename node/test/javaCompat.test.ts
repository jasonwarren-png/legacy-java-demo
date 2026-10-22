// Node-only tests for the helpers that reproduce Java/Spring semantics.
import { describe, expect, it } from 'vitest';
import { messages, validationMessages } from '../src/i18n/index.js';
import { parseLocale } from '../src/i18n/locale.js';
import { parseProperties } from '../src/i18n/properties.js';
import { interpolate } from '../src/validation/constraints.js';
import { encodeUriStrict, javaStrip, javaTrim, parseJavaInt } from '../src/validation/javaText.js';

describe('Java compatibility helpers', () => {
	it('parses ints like Spring NumberUtils', () => {
		expect(parseJavaInt('2')).toBe(2);
		expect(parseJavaInt(' 2 ')).toBe(2);
		expect(parseJavaInt('+7')).toBe(7);
		expect(parseJavaInt('0x1F')).toBe(31);
		expect(parseJavaInt('#10')).toBe(16);
		expect(parseJavaInt('010')).toBe(10);
		expect(parseJavaInt('2147483647')).toBe(2147483647);
		expect(parseJavaInt('2147483648')).toBeUndefined();
		expect(parseJavaInt('abc')).toBeUndefined();
		expect(parseJavaInt('1.5')).toBeUndefined();
	});

	it('trims and strips like java.lang.String', () => {
		expect(javaTrim('\u0001 a \t')).toBe('a');
		expect(javaTrim('\u00a0a')).toBe('\u00a0a');
		expect(javaStrip('\u3000a\u2003')).toBe('a');
		expect(javaStrip('\u00a0a')).toBe('\u00a0a');
	});

	it('encodes like UriUtils.encode', () => {
		expect(encodeUriStrict("O'Brien (x)")).toBe('O%27Brien%20%28x%29');
	});

	it('parses .properties files like java.util.Properties', () => {
		const props = parseProperties('# c\n! c\na=1\nb : two \\\n  lines\nc\\u0041=\\u00e9\\n\nkey\\ with\\ space=v\nnew=New \n');
		expect(Object.fromEntries(props)).toEqual({ a: '1', b: 'two lines', 'cA': 'é\n', 'key with space': 'v', new: 'New ' });
	});

	it('resolves messages with locale fallback', () => {
		expect(messages.get('owner', parseLocale('de')!)).toBe('Besitzer');
		expect(messages.get('owner', parseLocale('pt_BR')!)).toBe('Proprietário');
		expect(messages.get('owner', parseLocale('fr')!)).toBe('Owner');
		expect(messages.get('missing', parseLocale('fr')!)).toBe('??missing_fr??');
		expect(validationMessages.find('jakarta.validation.constraints.NotBlank.message', parseLocale('hi')!)).toBe('must not be blank');
	});

	it('interpolates constraint messages', () => {
		expect(interpolate('{jakarta.validation.constraints.Size.message}', { min: 0, max: 30 }, parseLocale('tr')!)).toBe("boyut '0' ile '30' arasında olmalı");
		expect(interpolate('{telephone.invalid}', {}, parseLocale('de')!)).toBe('Telefonnummer muss aus 10 Ziffern bestehen');
	});
});

describe('Thymeleaf-compatible escaping', () => {
	it('escapes th:field values with HTML 4 named references', async () => {
		const { escapeHtml4Attribute } = await import('../src/web/view.js');
		expect(escapeHtml4Attribute('a\u00a0b\u00adc\u2007d\u200be\u00a9f\u20acg\u00e9h\\i<"\'&')).toBe('a&nbsp;b&shy;c\u2007d\u200be&copy;f&euro;g&eacute;h\\i&lt;&quot;&#39;&amp;');
	});

	it('encodes redirect query values like URLEncoder', async () => {
		const { encodeFormComponent } = await import('../src/validation/javaText.js');
		expect(encodeFormComponent('a~b*c.d-e_f!g(h)i,j;k:l@m/n?o+p&q r\'')).toBe('a%7Eb*c.d-e_f%21g%28h%29i%2Cj%3Bk%3Al%40m%2Fn%3Fo%2Bp%26q+r%27');
	});
});
