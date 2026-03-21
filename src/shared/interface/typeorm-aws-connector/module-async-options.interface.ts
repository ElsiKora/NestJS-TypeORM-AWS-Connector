import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from "@nestjs/common/interfaces";

import type { ITypeOrmAwsConnectorConfig } from "./config.interface";

export interface ITypeOrmAwsConnectorModuleAsyncOptions<TFactoryArguments extends Array<unknown> = Array<unknown>> extends Pick<ModuleMetadata, "imports"> {
	dataSourceToken?: InjectionToken;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
	useFactory: (...arguments_: TFactoryArguments) => ITypeOrmAwsConnectorConfig | Promise<ITypeOrmAwsConnectorConfig>;
}
