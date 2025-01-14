import type { IDatabaseConfigRotation } from "@shared/type/database/config-rotation.type";
import type { EDatabaseType } from "@shared/enum/database/type.enum";
import type { EntitySchema, MixedList } from "typeorm";
import {ERelationLoadStrategy} from "@shared/enum/relation-load-strategy.enum";

export interface ITypeOrmAwsConnectorConfig {
	type: EDatabaseType;
	port: number;
	databaseName: string;
	relationLoadStrategy?: ERelationLoadStrategy;
	isVerbose?: boolean;
	shouldSynchronize?: boolean;
	connectionTimeoutMs?: number;
	idleTimeoutMs?: number;
	poolSize?: number;
	entities: MixedList<Function | string | EntitySchema>;
	rotation?: IDatabaseConfigRotation;
}
