import type { Provider } from "@nestjs/common";
import type { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector/module-async-options.interface";
import {ITypeOrmAwsConnectorConfig} from "@shared/interface/typeorm-aws-connector/config.interface";

export const DATABASE_CONFIG_PROVIDER = "DATABASE_CONFIG_PROVIDER";

export function createDatabaseConfigProvider(options: ITypeOrmAwsConnectorModuleAsyncOptions): Provider {
	return {
		provide: DATABASE_CONFIG_PROVIDER,
		useFactory: options.useFactory,
		inject: options.inject || [],
	};
}
