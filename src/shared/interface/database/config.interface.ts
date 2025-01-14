import type { IDatabaseConfigRotation } from "@shared/type/database/config-rotation.type";
import type { EDatabaseType } from "@shared/enum/database/type.enum";
import type { EntitySchema, MixedList } from "typeorm";

export interface IDatabaseConfig {
	type: EDatabaseType;
	port: number;
	databaseName: string;
	isVerbose: boolean;
	shouldSynchronize?: boolean;
	connectionTimeoutMs: number;
	idleTimeoutMs: number;
	poolSize: number;
	entities: MixedList<Function | string | EntitySchema>;
	rotation?: IDatabaseConfigRotation;
}
