export interface Secrets {
	wixkey: string;
};

export interface Settings {
	host: string;
	port: number;
	secrets: Secrets;
	warthunder: {
		paths: {
			mission: string;
			map: {
				image: string;
				info: string;
				objects: string;
			};

			messages: {
				chat: string;
				hud: string;
			};

			vehicle: {
				indicators: string;
				state: string;
			};
		};

		port: number;
		waitingTime: number;
	};
};


export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
export type RequestResponseType = "headers" | "json" | "raw" | "text";

export interface RequestOptions {
	auth?: string;
	body?: any;
	headers?: import("http").OutgoingHttpHeaders;
	method?: RequestMethod;
	secure?: boolean;
	type: RequestResponseType;
	url: URL | string;
};


export interface Song {
	state: "PLAYING" | "PAUSED" | "STOPPED";
	track: string;
	artist: string;
	album: string;
	startedAt?: number;
	pausedAt?: number;
	duration: number;
	spotifyArtwork?: string;
	spotifyArtworkURL?: string;
	spotifyArtistIconURL?: string;
	spotifyId?: string;
	color?: string;
	path?: string;
};

type HttpHandler = (
	logger: import("@wixonic/logger").Logger,
	settings: Settings,
	req: import("express").Request,
	res: import("express").Response
) => Promise<void>;

type WSHandler = (
	logger: import("@wixonic/logger").Logger,
	settings: Settings,
	ws: import("ws").WebSocket
) => Promise<void>;

type LoopHandler = (
	logger: import("@wixonic/logger").Logger,
	settings: Settings
) => Promise<boolean>;

export interface HandlerInfo {
	path: string;
	handlers: {
		get: HttpHandler?;
		post: HttpHandler?;
		put: HttpHandler?;
		patch: HttpHandler?;
		delete: HttpHandler?;
		options: HttpHandler?;
		ws: WSHandler?;
	};
	loop: {
		delay: number;
		process: LoopHandler;
	}
};