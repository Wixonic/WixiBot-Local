import { ActivitiesOptions, CustomStatus, RichPresence, SpotifyRPC } from "discord.js-selfbot-v13";

export interface ClientConfig {
	host: string;
	wixkey: string;
};

export interface DiscordClient {
	id: string;
	assets: Record<string, string>;
};

export interface DiscordConfig {
	application: {
		clients: Record<string, DiscordClient>;
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


export interface ClientSecrets {
	wixkey: string;
};

export interface DiscordSecrets {
	token: string;
};

export interface SpotifySecrets {
	id: string;
	secret: string;
};

export interface Secrets {
	client: ClientSecrets;
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

export type Activity = ActivitiesOptions | RichPresence | SpotifyRPC | CustomStatus;