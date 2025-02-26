export interface ClientConfig {
	host: string;
};

export interface ServerConfig {
	port: number;
};

export interface Config {
	client: ClientConfig;
	server: ServerConfig;
};


export interface DiscordSecrets {
	token: string;
};

export interface Secrets {
	discord: DiscordSecrets;
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