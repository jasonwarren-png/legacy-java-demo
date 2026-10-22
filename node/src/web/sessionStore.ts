import session from 'express-session';

interface Entry {
	data: string;
	lastAccess: number;
}

/**
 * In-memory session store with an idle timeout, like Tomcat's default session manager. (express-session's
 * MemoryStore never drops sessions whose cookie has no expiry, so it would grow without bound.)
 */
export class IdleTimeoutMemoryStore extends session.Store {
	private readonly sessions = new Map<string, Entry>();

	constructor(
		private readonly idleTimeoutMs: number,
		private readonly now: () => number = Date.now,
	) {
		super();
		setInterval(() => this.prune(), Math.min(idleTimeoutMs, 60_000)).unref();
	}

	prune(): void {
		const cutoff = this.now() - this.idleTimeoutMs;
		for (const [sid, entry] of this.sessions) {
			if (entry.lastAccess < cutoff) {
				this.sessions.delete(sid);
			}
		}
	}

	get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
		const entry = this.sessions.get(sid);
		if (!entry || entry.lastAccess < this.now() - this.idleTimeoutMs) {
			this.sessions.delete(sid);
			callback(null, null);
			return;
		}
		entry.lastAccess = this.now();
		callback(null, JSON.parse(entry.data) as session.SessionData);
	}

	set(sid: string, data: session.SessionData, callback?: (err?: unknown) => void): void {
		this.sessions.set(sid, { data: JSON.stringify(data), lastAccess: this.now() });
		callback?.();
	}

	destroy(sid: string, callback?: (err?: unknown) => void): void {
		this.sessions.delete(sid);
		callback?.();
	}

	touch(sid: string, _data: session.SessionData, callback?: () => void): void {
		const entry = this.sessions.get(sid);
		if (entry) {
			entry.lastAccess = this.now();
		}
		callback?.();
	}

	get size(): number {
		return this.sessions.size;
	}
}
