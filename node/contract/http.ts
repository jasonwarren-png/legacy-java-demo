/** A minimal HTTP client with a per-application cookie jar, so each app keeps its own session. */
export interface ContractRequest {
	method?: string;
	path: string;
	headers?: Record<string, string>;
	/** Sent as application/x-www-form-urlencoded; repeated keys are allowed. */
	form?: [string, string][];
	body?: string;
}

export interface ContractResponse {
	status: number;
	headers: Headers;
	body: string;
}

export class AppClient {
	private readonly cookies = new Map<string, string>();

	constructor(
		readonly name: string,
		readonly baseUrl: string,
	) {}

	async send(req: ContractRequest): Promise<ContractResponse> {
		const headers: Record<string, string> = { accept: '*/*', ...req.headers };
		let body: string | undefined = req.body;
		if (req.form) {
			body = new URLSearchParams(req.form).toString();
			headers['content-type'] = 'application/x-www-form-urlencoded';
		}
		if (this.cookies.size > 0) {
			headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
		}
		const res = await fetch(this.baseUrl + req.path, { method: req.method ?? 'GET', headers, body, redirect: 'manual' });
		for (const cookie of res.headers.getSetCookie()) {
			const [pair = ''] = cookie.split(';');
			const eq = pair.indexOf('=');
			this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
		}
		return { status: res.status, headers: res.headers, body: await res.text() };
	}

	clearCookies(): void {
		this.cookies.clear();
	}
}
