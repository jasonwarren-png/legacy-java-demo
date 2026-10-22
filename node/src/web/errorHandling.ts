import type { ErrorRequestHandler, Request, RequestHandler, Response, Router } from 'express';
import { STATUS_CODES } from 'node:http';
import { HttpError, methodNotAllowed, notFound } from './httpErrors.js';
import { render } from './view.js';

/** BasicErrorController picks the HTML error page only when the client explicitly accepts text/html. */
function acceptsHtml(req: Request): boolean {
	return (req.get('accept') ?? '')
		.split(',')
		.map((part) => part.trim().split(';'))
		.some(([type, ...params]) => {
			const q = params.find((p) => p.trim().startsWith('q='));
			return (type === 'text/html' || type === 'text/*') && (!q || Number(q.trim().slice(2)) > 0);
		});
}

export function sendError(req: Request, res: Response, status: number, headers: Record<string, string> = {}): void {
	res.set(headers);
	if (acceptsHtml(req)) {
		render(res, 'error.njk', { status, menu: 'error' }, status);
		return;
	}
	res.status(status);
	res.setHeader('Content-Type', 'application/json');
	res.end(
		JSON.stringify({ timestamp: new Date().toISOString(), status, error: STATUS_CODES[status], path: req.path }),
	);
}

export const notFoundHandler: RequestHandler = (req, _res, next) => next(notFound(req.path));

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
	if (err instanceof HttpError) {
		sendError(req, res, err.status, err.headers);
		return;
	}
	console.error(`Request processing failed for ${req.method} ${req.originalUrl}`, err);
	sendError(req, res, 500);
};

/**
 * Spring MVC answers OPTIONS automatically and returns 405 (with Allow) for a known path with an unmapped method.
 * Register after the real handlers for `path`.
 */
export function methodFallbacks(router: Router, path: string, allowed: ('GET' | 'POST')[]): void {
	const optionsAllow = ['GET', 'HEAD', ...allowed.filter((m) => m !== 'GET'), 'OPTIONS'].join(',');
	router.options(path, (_req, res) => {
		res.status(200).set('Allow', optionsAllow).set('Accept-Patch', '').end();
	});
	router.all(path, (req, _res, next) => next(methodNotAllowed(req.method, allowed)));
}
