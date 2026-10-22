import type { NextFunction, Request, RequestHandler, Response } from 'express';
import nunjucks from 'nunjucks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../i18n/index.js';
import { ENGLISH, languageTag, parseLocale, type Locale } from '../i18n/locale.js';
import { parseJavaInt } from '../validation/javaText.js';
import { HTML4_NAMED_REFERENCES } from './html4Entities.js';
import { badRequest } from './httpErrors.js';
import './session.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const MARKUP_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeMarkup = (value: string) => value.replace(/[&<>"']/g, (c) => MARKUP_ESCAPES[c] ?? c);

// Thymeleaf's th:text escaping (unbescape level 1) only escapes markup-significant characters; nunjucks would
// also turn `\` into `&#92;`.
(nunjucks.lib as unknown as { escape: (value: string) => string }).escape = escapeMarkup;

export const views = nunjucks.configure(resolve(projectRoot, 'views'), { autoescape: true, throwOnUndefined: false });

/**
 * th:field values are escaped like unbescape's escapeHtml4 (level 2): markup-significant characters plus every
 * character that has an HTML 4 named reference (e.g. U+00A0 -> &nbsp;, é -> &eacute;).
 */
export function escapeHtml4Attribute(value: string): string {
	let out = '';
	for (const ch of value) {
		const named = HTML4_NAMED_REFERENCES.get(ch.codePointAt(0) ?? 0);
		out += named ? `&${named};` : escapeMarkup(ch);
	}
	return out;
}
views.addFilter('fieldValue', (value: unknown) => new nunjucks.runtime.SafeString(escapeHtml4Attribute(value == null ? '' : String(value))));

const FLASH_TIMEOUT_MS = 180_000;

declare module 'express-serve-static-core' {
	interface Locals {
		locale: Locale;
		flash: Record<string, string>;
	}
}

/** LocaleChangeInterceptor(paramName = "lang") + SessionLocaleResolver(default = ENGLISH). */
export const localeMiddleware: RequestHandler = (req, res, next) => {
	if (req.query.lang !== undefined) {
		const value = firstValue(req.query.lang) ?? '';
		const locale = parseLocale(value);
		if (locale) {
			req.session.locale = languageTag(locale);
		}
		else if (req.session.locale) {
			delete req.session.locale;
		}
	}
	res.locals.locale = (req.session.locale && parseLocale(req.session.locale)) || ENGLISH;
	next();
};

/** SessionFlashMapManager: hands the matching flash map (if any) to this request and removes it. */
export const flashMiddleware: RequestHandler = (req, res, next) => {
	res.locals.flash = {};
	const maps = req.session.flashMaps;
	if (maps && maps.length > 0) {
		const now = Date.now();
		const live = maps.filter((m) => m.expiresAt > now);
		const index = live.findIndex((m) => m.targetPath === req.path || `${m.targetPath}/` === req.path);
		if (index >= 0) {
			res.locals.flash = live[index]?.attributes ?? {};
			live.splice(index, 1);
		}
		if (index >= 0 || live.length !== maps.length) {
			req.session.flashMaps = live;
		}
	}
	next();
};

/** Spring's UrlPathHelper strips `;jsessionid=...` and other matrix parameters from each path segment. */
export const stripMatrixParams: RequestHandler = (req, _res, next) => {
	const queryStart = req.url.indexOf('?');
	const path = queryStart >= 0 ? req.url.slice(0, queryStart) : req.url;
	if (path.includes(';')) {
		req.url = path.replace(/;[^/]*/g, '') + (queryStart >= 0 ? req.url.slice(queryStart) : '');
	}
	next();
};

export function firstValue(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		return value.length > 0 ? String(value[0]) : undefined;
	}
	return typeof value === 'string' ? value : undefined;
}

/** All request parameters (query string first, then form body), like ServletRequest#getParameterValues. */
export function requestParams(req: Request): Map<string, string[]> {
	const params = new Map<string, string[]>();
	const add = (source: unknown) => {
		if (!source || typeof source !== 'object') return;
		for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
			const values = (Array.isArray(value) ? value : [value]).map(String);
			params.set(key, [...(params.get(key) ?? []), ...values]);
		}
	};
	add(req.query);
	add(req.body);
	return params;
}

/** @RequestParam(defaultValue = ...) int, or an int @PathVariable. */
export function intParam(raw: unknown, name: string, defaultValue?: number): number {
	const value = firstValue(raw);
	if ((value === undefined || value === '') && defaultValue !== undefined) {
		return defaultValue;
	}
	const parsed = value === undefined ? undefined : parseJavaInt(value);
	if (parsed === undefined) {
		throw badRequest(`Method parameter '${name}': Failed to convert value of type 'java.lang.String' to required type 'int'`);
	}
	return parsed;
}

export function render(res: Response, template: string, model: Record<string, unknown>, status = 200): void {
	const locale = res.locals.locale ?? ENGLISH;
	const html = views.render(template, {
		...model,
		flash: res.locals.flash ?? {},
		t: (code: string) => messages.get(code, locale),
	});
	// setHeader/end instead of set/send: Express would rewrite the Content-Type to `text/html; charset=utf-8`.
	res.status(status);
	res.setHeader('Content-Type', 'text/html;charset=UTF-8');
	res.setHeader('Content-Language', languageTag(locale));
	res.end(html);
}

/** "redirect:" view: 302 with an absolute Location, empty body, optional flash attributes for the target. */
export function redirect(req: Request, res: Response, path: string, flash?: Record<string, string>): void {
	if (flash) {
		const targetPath = path.split('?')[0] ?? path;
		const maps = req.session.flashMaps ?? [];
		maps.push({ targetPath, attributes: flash, expiresAt: Date.now() + FLASH_TIMEOUT_MS });
		req.session.flashMaps = maps;
	}
	res
		.status(302)
		.set('Location', `${req.protocol}://${req.get('host')}${path}`)
		.set('Content-Language', languageTag(res.locals.locale ?? ENGLISH))
		.end();
}

export const asyncHandler =
	(fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
	(req: Request, res: Response, next: NextFunction) => {
		fn(req, res).catch(next);
	};
