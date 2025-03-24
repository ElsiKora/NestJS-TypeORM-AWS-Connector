import type { EService } from "@elsikora/nestjs-aws-parameter-store-config";
import type { EDatabaseType, ERelationLoadStrategy } from "@shared/enum";
import type { TDatabaseConfigRotation } from "@shared/type/database";
import type { EntitySchema, MixedList } from "typeorm";

export interface ITypeOrmAwsConnectorConfig {
	connectionTimeoutMs?: number;
	databaseName: string;
	// eslint-disable-next-line @elsikora/typescript/no-unsafe-function-type
	entities: MixedList<EntitySchema | Function | string>;
	host?: {
		path?: Array<string>;
		service?: EService;
	};
	idleTimeoutMs?: number;
	isVerbose?: boolean;
	poolSize?: number;
	port: number;
	relationLoadStrategy?: ERelationLoadStrategy;
	rotation?: TDatabaseConfigRotation;
	secretID?: {
		path?: Array<string>;
		service?: EService;
	};
	shouldSynchronize?: boolean;
	type: EDatabaseType;
}
