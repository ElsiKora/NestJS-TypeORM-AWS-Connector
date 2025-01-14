import type { Provider } from "@nestjs/common";
import type { IDatabaseModuleAsyncOptions } from "@shared/interface/database/module-async-options.interface";

export const DATABASE_CONFIG_PROVIDER = "DATABASE_CONFIG_PROVIDER";

export function createDatabaseConfigProvider(options: IDatabaseModuleAsyncOptions): Provider {
	return {
		provide: DATABASE_CONFIG_PROVIDER,
		useFactory: options.useFactory,
		inject: options.inject || [],
	};
}
