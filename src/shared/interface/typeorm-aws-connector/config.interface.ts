import type { EDatabaseType, ERelationLoadStrategy } from "@shared/enum";
import type { TDatabaseConfigRotation } from "@shared/type/database";
import type { EntitySchema, MixedList } from "typeorm";

import type { ITypeOrmAwsConnectorSsmLookupDefaults } from "./ssm-lookup-defaults.interface";
import type { ITypeOrmAwsConnectorSsmLookups } from "./ssm-lookups.interface";

export interface ITypeOrmAwsConnectorConfig {
	connectionTimeoutMs?: number;
	databaseName?: string;
	// eslint-disable-next-line @elsikora/typescript/no-unsafe-function-type
	entities: MixedList<EntitySchema | Function | string>;
	host?: string;
	idleTimeoutMs?: number;
	isVerbose?: boolean;
	password?: string;
	poolSize?: number;
	port?: number;
	relationLoadStrategy?: ERelationLoadStrategy;
	rotation?: TDatabaseConfigRotation;
	secretId?: string;
	shouldSynchronize?: boolean;
	ssmLookupDefaults?: ITypeOrmAwsConnectorSsmLookupDefaults;
	ssmLookups?: ITypeOrmAwsConnectorSsmLookups;
	type?: EDatabaseType;
	username?: string;
}
