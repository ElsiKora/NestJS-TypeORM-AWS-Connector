import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from "@nestjs/common/interfaces";
import type { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

export interface ITypeOrmAwsConnectorModuleAsyncOptions<TFactoryArguments extends Array<unknown> = Array<unknown>> extends Pick<ModuleMetadata, "imports"> {
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
	useFactory: (...arguments_: TFactoryArguments) => Promise<TTypeOrmAwsConnectorModuleOptions> | TTypeOrmAwsConnectorModuleOptions;
}
