const SWAGGER_SAVE_SPACES: number = 2;
const DB_CONNECTION_TIMEOUT: number = 30_000;
const DB_IDLE_TIMEOUT: number = 30_000;
const DB_RECONNECT_TIMEOUT: number = 3000;
const DB_POOL_SIZE: number = 10;
const DB_PORT: number = 5432;
const DB_RELATION_LOAD_STRATEGY: "join" | "query" | undefined = "query";
const DB_SYNCHRONIZE: boolean = false;
const DB_TYPE: "mysql" | "postgres" = "postgres";
const DB_LOGGING: boolean = false;
const DB_DATABASE_NAME: string = "my_default_database";
const DATABASE_CONNECTION_ROTAION_INTERVAL: number = 1000 * 60 * 60; // 1 hour in milliseconds

const CONFIG_CONSTANT: {
	readonly DATABASE_CONNECTION_ROTAION_INTERVAL: number;
	readonly DB_CONNECTION_TIMEOUT: number;
	readonly DB_DATABASE_NAME: string;
	readonly DB_IDLE_TIMEOUT: number;
	readonly DB_LOGGING: boolean;
	readonly DB_POOL_SIZE: number;
	readonly DB_PORT: number;
	readonly DB_RECONNECT_TIMEOUT: number;
	readonly DB_RELATION_LOAD_STRATEGY: "join" | "query" | undefined;
	readonly DB_SYNCHRONIZE: boolean;
	readonly DB_TYPE: "postgres";
	readonly SWAGGER_SAVE_SPACES: number;
} = {
	DATABASE_CONNECTION_ROTAION_INTERVAL,
	DB_CONNECTION_TIMEOUT,
	DB_DATABASE_NAME,
	DB_IDLE_TIMEOUT,
	DB_LOGGING,
	DB_POOL_SIZE,
	DB_PORT,
	DB_RECONNECT_TIMEOUT,
	DB_RELATION_LOAD_STRATEGY,
	DB_SYNCHRONIZE,
	DB_TYPE,
	SWAGGER_SAVE_SPACES,
} as const;

export default CONFIG_CONSTANT;
