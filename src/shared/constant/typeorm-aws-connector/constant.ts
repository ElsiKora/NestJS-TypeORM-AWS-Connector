import type { IStructuredLookup } from "@shared/interface/typeorm-aws-connector";

import { ENamespace } from "@elsikora/nestjs-aws-parameter-store-config";
import { ERelationLoadStrategy } from "@shared/enum";

const CANONICAL_SSM_LOOKUPS: Readonly<Record<"connectionTimeoutMs" | "databaseName" | "host" | "idleTimeoutMs" | "isVerbose" | "poolSize" | "port" | "relationLoadStrategy" | "rotationIntervalMs" | "rotationIsEnabled" | "secretId" | "shouldSynchronize" | "type", IStructuredLookup>> = {
	connectionTimeoutMs: {
		path: ["typeorm", "connection-timeout-ms"],
	},
	databaseName: {
		path: ["postgres", "database-name"],
	},
	host: {
		instanceName: "aurora-postgres",
		namespace: ENamespace.AWS_RDS,
		path: ["host"],
	},
	idleTimeoutMs: {
		path: ["typeorm", "idle-timeout-ms"],
	},
	isVerbose: {
		path: ["typeorm", "logging"],
	},
	poolSize: {
		path: ["typeorm", "pool-size"],
	},
	port: {
		instanceName: "aurora-postgres",
		namespace: ENamespace.AWS_RDS,
		path: ["port"],
	},
	relationLoadStrategy: {
		path: ["typeorm", "relation-load-strategy"],
	},
	rotationIntervalMs: {
		path: ["typeorm", "rotation", "interval-ms"],
	},
	rotationIsEnabled: {
		path: ["typeorm", "rotation", "enabled"],
	},
	secretId: {
		instanceName: "database",
		namespace: ENamespace.AWS_SECRETS_MANAGER,
		path: ["secret-id"],
	},
	shouldSynchronize: {
		path: ["typeorm", "synchronize"],
	},
	type: {
		path: ["postgres", "type"],
	},
};

const SSM_FIELD_LABELS: Readonly<Record<keyof typeof CANONICAL_SSM_LOOKUPS, string>> = {
	connectionTimeoutMs: "connectionTimeoutMs",
	databaseName: "databaseName",
	host: "host",
	idleTimeoutMs: "idleTimeoutMs",
	isVerbose: "isVerbose",
	poolSize: "poolSize",
	port: "port",
	relationLoadStrategy: "relationLoadStrategy",
	rotationIntervalMs: "rotation.intervalMs",
	rotationIsEnabled: "rotation.isEnabled",
	secretId: "secret-id",
	shouldSynchronize: "shouldSynchronize",
	type: "type",
};

const DATABASE_CONNECTION_TIMEOUT: number = 30_000;
const DATABASE_IDLE_TIMEOUT: number = 30_000;
const DATABASE_POOL_SIZE: number = 10;
const DATABASE_CONNECTION_ROTATION_INTERVAL: number = 1000 * 60 * 60;
const DATABASE_ROTATION_INTERVAL_NAME: string = "db-rotation";
const DATABASE_RELATION_LOAD_STRATEGY: ERelationLoadStrategy = ERelationLoadStrategy.QUERY;
const IS_DATABASE_SYNCHRONIZATION_ENABLED: boolean = false;
const IS_DATABASE_LOGGING_ENABLED: boolean = false;
const SECRETS_MANAGER_CURRENT_VERSION_STAGE: string = "AWSCURRENT";

const TYPEORM_AWS_CONNECTOR_CONSTANT: {
	readonly CANONICAL_SSM_LOOKUPS: typeof CANONICAL_SSM_LOOKUPS;
	readonly DATABASE_CONNECTION_ROTATION_INTERVAL: number;
	readonly DATABASE_CONNECTION_TIMEOUT: number;
	readonly DATABASE_IDLE_TIMEOUT: number;
	readonly DATABASE_POOL_SIZE: number;
	readonly DATABASE_RELATION_LOAD_STRATEGY: ERelationLoadStrategy;
	readonly DATABASE_ROTATION_INTERVAL_NAME: string;
	readonly IS_DATABASE_LOGGING_ENABLED: boolean;
	readonly IS_DATABASE_SYNCHRONIZATION_ENABLED: boolean;
	readonly SECRETS_MANAGER_CURRENT_VERSION_STAGE: string;
	readonly SSM_FIELD_LABELS: typeof SSM_FIELD_LABELS;
} = {
	CANONICAL_SSM_LOOKUPS,
	DATABASE_CONNECTION_ROTATION_INTERVAL,
	DATABASE_CONNECTION_TIMEOUT,
	DATABASE_IDLE_TIMEOUT,
	DATABASE_POOL_SIZE,
	DATABASE_RELATION_LOAD_STRATEGY,
	DATABASE_ROTATION_INTERVAL_NAME,
	IS_DATABASE_LOGGING_ENABLED,
	IS_DATABASE_SYNCHRONIZATION_ENABLED,
	SECRETS_MANAGER_CURRENT_VERSION_STAGE,
	SSM_FIELD_LABELS,
} as const;

export default TYPEORM_AWS_CONNECTOR_CONSTANT;
