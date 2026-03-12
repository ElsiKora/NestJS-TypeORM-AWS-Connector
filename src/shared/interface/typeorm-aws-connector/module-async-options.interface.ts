import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from "@nestjs/common/interfaces";
import type { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

export interface ITypeOrmAwsConnectorModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
	useFactory: (...arguments_: Array<unknown>) => Promise<TTypeOrmAwsConnectorModuleOptions> | TTypeOrmAwsConnectorModuleOptions;
}
