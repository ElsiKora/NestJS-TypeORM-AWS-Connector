import "reflect-metadata";

import { Module } from "@nestjs/common";
import { TypeOrmAwsConnectorModule } from "@elsikora/nestjs-typeorm-aws-connector";

import { PROVIDER_DATABASE_CONFIG } from "./provider-database-config.constant.mjs";
import { ProviderDataSourceModule } from "./provider-data-source.module.mjs";
import { PROVIDER_DATA_SOURCE_TOKEN } from "./provider-data-source-token.constant.mjs";
import { ProviderConnectorProbeService } from "./provider-connector-probe.service.mjs";
import { TestInfrastructureModule } from "./test-infrastructure.module.mjs";

class ProviderDatabaseTestModule {}

Module({
	exports: [ProviderConnectorProbeService],
	imports: [
		ProviderDataSourceModule,
		TestInfrastructureModule,
		TypeOrmAwsConnectorModule.registerAsync({
			dataSourceToken: PROVIDER_DATA_SOURCE_TOKEN,
			useFactory: async () => PROVIDER_DATABASE_CONFIG,
		}),
	],
	providers: [ProviderConnectorProbeService],
})(ProviderDatabaseTestModule);

export { ProviderDatabaseTestModule };
