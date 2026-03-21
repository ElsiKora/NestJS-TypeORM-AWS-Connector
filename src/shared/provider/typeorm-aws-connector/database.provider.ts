import type { Provider } from "@nestjs/common";
import type { ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector/config.interface";
import type { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector/module-async-options.interface";
import type { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector/module-options.type";

import { DATABASE_CONFIG_PROVIDER } from "@shared/constant/typeorm-aws-connector";

/**
 * @param {ITypeOrmAwsConnectorModuleAsyncOptions} options - The options for the async module.
 * @returns {Provider} - The created database config provider.
 */
export function createDatabaseConfigProvider<TFactoryArguments extends Array<unknown> = Array<unknown>>(options: ITypeOrmAwsConnectorModuleAsyncOptions<TFactoryArguments>): Provider {
	return {
		inject: options.inject ?? [],
		provide: DATABASE_CONFIG_PROVIDER,
		useFactory: async (...arguments_: TFactoryArguments) => toTypeOrmAwsConnectorConfig(await options.useFactory(...arguments_)),
	};
}

/**
 * @param {TTypeOrmAwsConnectorModuleOptions} options - The module options including the optional DataSource token.
 * @returns {ITypeOrmAwsConnectorConfig} - The connector configuration without module-only fields.
 */
export function toTypeOrmAwsConnectorConfig(options: TTypeOrmAwsConnectorModuleOptions): ITypeOrmAwsConnectorConfig {
	const databaseConfig: TTypeOrmAwsConnectorModuleOptions = { ...options };

	delete databaseConfig.dataSourceToken;

	return databaseConfig as ITypeOrmAwsConnectorConfig;
}
