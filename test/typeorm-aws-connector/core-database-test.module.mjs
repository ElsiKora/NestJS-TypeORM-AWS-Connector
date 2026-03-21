import "reflect-metadata";

import { Module } from "@nestjs/common";
import { TypeOrmAwsConnectorModule } from "@elsikora/nestjs-typeorm-aws-connector";

import { CORE_DATABASE_CONFIG } from "./core-database-config.constant.mjs";
import { CoreDataSourceModule } from "./core-data-source.module.mjs";
import { CORE_DATA_SOURCE_TOKEN } from "./core-data-source-token.constant.mjs";
import { CoreConnectorProbeService } from "./core-connector-probe.service.mjs";
import { TestInfrastructureModule } from "./test-infrastructure.module.mjs";

class CoreDatabaseTestModule {}

Module({
	exports: [CoreConnectorProbeService],
	imports: [
		CoreDataSourceModule,
		TestInfrastructureModule,
		TypeOrmAwsConnectorModule.registerAsync({
			dataSourceToken: CORE_DATA_SOURCE_TOKEN,
			useFactory: async () => CORE_DATABASE_CONFIG,
		}),
	],
	providers: [CoreConnectorProbeService],
})(CoreDatabaseTestModule);

export { CoreDatabaseTestModule };
