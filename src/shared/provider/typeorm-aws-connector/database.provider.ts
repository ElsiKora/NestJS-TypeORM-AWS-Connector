import type { Provider } from "@nestjs/common";
import type { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector/module-async-options.interface";

export const DATABASE_CONFIG_PROVIDER: string = "DATABASE_CONFIG_PROVIDER";

/**
 * @param {ITypeOrmAwsConnectorModuleAsyncOptions} options - The options for the async module.
 * @returns {Provider} - The created database config provider.
 */
export function createDatabaseConfigProvider(options: ITypeOrmAwsConnectorModuleAsyncOptions): Provider {
	return {
		inject: options.inject ?? [],
		provide: DATABASE_CONFIG_PROVIDER,
		useFactory: options.useFactory,
	};
}
