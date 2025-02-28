export interface ClientConfig {
	host: string;
	wixkey: string;
};

export interface DiscordConfig {
	application: {
		clientId: string;
		assets: Record<string, string>;
	};

	token: string;
};

export interface ServerConfig {
	port: number;
};

export interface SpotifyConfig {
	id: string;
	secret: string;
};

export interface WarThunderConfig {
	paths: {
		map: {
			image: string;
			info: string;
			objects: string;
		};

		vehicle: {
			indicators: string;
			state: string;
		};
	};

	port: number;
	waitingTime: number;
};

export interface Config {
	client: ClientConfig;
	discord: DiscordConfig;
	server: ServerConfig;
	spotify: SpotifyConfig;
	warThunder: WarThunderConfig;
};


export interface DiscordSecrets {
	token: string;
};

export interface SpotifySecrets {
	id: string;
	secret: string;
};

export interface Secrets {
	discord: DiscordSecrets;
	spotify: SpotifySecrets;
};

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
export type RequestResponseType = "headers" | "json" | "raw" | "text";

export interface RequestOptions {
	auth?: string;
	body?: object;
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