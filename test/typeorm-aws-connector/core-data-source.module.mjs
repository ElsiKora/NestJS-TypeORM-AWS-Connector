import "reflect-metadata";

import { Global, Module } from "@nestjs/common";

import { CORE_DATA_SOURCE } from "./core-data-source.constant.mjs";
import { CORE_DATA_SOURCE_TOKEN } from "./core-data-source-token.constant.mjs";

class CoreDataSourceModule {}

Global()(CoreDataSourceModule);
Module({
	exports: [CORE_DATA_SOURCE_TOKEN],
	providers: [
		{
			provide: CORE_DATA_SOURCE_TOKEN,
			useValue: CORE_DATA_SOURCE,
		},
	],
})(CoreDataSourceModule);

export { CoreDataSourceModule };
