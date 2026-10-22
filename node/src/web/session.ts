import 'express-session';

export interface FlashMap {
	/** Path of the redirect target; the flash is consumed by the first request to it. */
	targetPath: string;
	attributes: Record<string, string>;
	expiresAt: number;
}

declare module 'express-session' {
	interface SessionData {
		locale?: string;
		flashMaps?: FlashMap[];
	}
}
