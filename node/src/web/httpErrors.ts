/** An error carrying the HTTP status Spring MVC would map it to. Anything else becomes a 500. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly headers: Record<string, string> = {},
	) {
		super(message);
	}
}

/** MethodArgumentTypeMismatchException and friends. */
export const badRequest = (message: string) => new HttpError(400, message);

/** NoResourceFoundException */
export const notFound = (path: string) => new HttpError(404, `No static resource ${path}.`);

/** HttpRequestMethodNotSupportedException */
export const methodNotAllowed = (method: string, allowed: string[]) =>
	new HttpError(405, `Request method '${method}' is not supported`, { Allow: allowed.join(', ') });
