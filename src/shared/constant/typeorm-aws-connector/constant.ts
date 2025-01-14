import { ERelationLoadStrategy } from "@shared/enum/relation-load-strategy.enum";

const DB_CONNECTION_TIMEOUT: number = 30_000;
const DB_IDLE_TIMEOUT: number = 30_000;
const DB_POOL_SIZE: number = 10;
const DB_RELATION_LOAD_STRATEGY: ERelationLoadStrategy = ERelationLoadStrategy.QUERY;
const DB_SYNCHRONIZE: boolean = false;
const DB_LOGGING: boolean = false;
const DB_CONNECTION_ROTATION_INTERVAL: number = 1000 * 60 * 60;

const TYPEORM_AWS_CONNECTOR_CONSTANT: {
	readonly DB_CONNECTION_ROTATION_INTERVAL: number;
	readonly DB_CONNECTION_TIMEOUT: number;
	readonly DB_IDLE_TIMEOUT: number;
	readonly DB_LOGGING: boolean;
	readonly DB_POOL_SIZE: number;
	readonly DB_RELATION_LOAD_STRATEGY: ERelationLoadStrategy;
	readonly DB_SYNCHRONIZE: boolean;
} = {
	DB_CONNECTION_ROTATION_INTERVAL,
	DB_CONNECTION_TIMEOUT,
	DB_IDLE_TIMEOUT,
	DB_LOGGING,
	DB_POOL_SIZE,
	DB_RELATION_LOAD_STRATEGY,
	DB_SYNCHRONIZE,
} as const;

export default TYPEORM_AWS_CONNECTOR_CONSTANT;
