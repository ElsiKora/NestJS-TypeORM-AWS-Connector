import "reflect-metadata";

import { Module } from "@nestjs/common";
import { TypeOrmAwsConnectorModule } from "@elsikora/nestjs-typeorm-aws-connector";

import { CORE_DATABASE_CONFIG } from "./core-database-config.constant.mjs";
import { LegacyConnectorProbeService } from "./legacy-connector-probe.service.mjs";
import { TestInfrastructureModule } from "./test-infrastructure.module.mjs";

class LegacyDatabaseTestModule {}

Module({
	exports: [LegacyConnectorProbeService],
	imports: [TestInfrastructureModule, TypeOrmAwsConnectorModule.register(CORE_DATABASE_CONFIG)],
	providers: [LegacyConnectorProbeService],
})(LegacyDatabaseTestModule);

export { LegacyDatabaseTestModule };
