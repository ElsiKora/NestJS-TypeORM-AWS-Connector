import "reflect-metadata";

import { ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

class TestInfrastructureModule {}

Global()(TestInfrastructureModule);
Module({
	exports: [ConfigService, ParameterStoreConfigService],
	providers: [
		{
			provide: ConfigService,
			useValue: {
				get: () => undefined,
			},
		},
		{
			provide: ParameterStoreConfigService,
			useValue: {
				get: () => null,
			},
		},
	],
})(TestInfrastructureModule);

export { TestInfrastructureModule };
