import "reflect-metadata";

import { Global, Module } from "@nestjs/common";

import { PROVIDER_DATA_SOURCE } from "./provider-data-source.constant.mjs";
import { PROVIDER_DATA_SOURCE_TOKEN } from "./provider-data-source-token.constant.mjs";

class ProviderDataSourceModule {}

Global()(ProviderDataSourceModule);
Module({
	exports: [PROVIDER_DATA_SOURCE_TOKEN],
	providers: [
		{
			provide: PROVIDER_DATA_SOURCE_TOKEN,
			useValue: PROVIDER_DATA_SOURCE,
		},
	],
})(ProviderDataSourceModule);

export { ProviderDataSourceModule };
