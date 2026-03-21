import "reflect-metadata";

import { Module } from "@nestjs/common";

import { CoreDatabaseTestModule } from "./core-database-test.module.mjs";
import { LegacyDatabaseTestModule } from "./legacy-database-test.module.mjs";
import { ProviderDatabaseTestModule } from "./provider-database-test.module.mjs";

class TestAppModule {}

Module({
	imports: [CoreDatabaseTestModule, ProviderDatabaseTestModule, LegacyDatabaseTestModule],
})(TestAppModule);

export { TestAppModule };
