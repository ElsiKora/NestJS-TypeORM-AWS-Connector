import { IDatabaseConfig } from "@shared/interface/database/config.interface";
import type { IDatabaseModuleOptions } from "@shared/interface/database/module-options.interface";

export interface IDatabaseModuleAsyncOptions {
	useFactory: (...arguments_: Array<any>) => Promise<IDatabaseModuleOptions> | IDatabaseModuleOptions;
	inject?: Array<any>;
	imports?: Array<any>;
	enableRotation?: boolean;
}
