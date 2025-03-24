import type { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

export interface ITypeOrmAwsConnectorModuleAsyncOptions {
	imports?: Array<any>;
	inject?: Array<any>;
	useFactory: (...arguments_: Array<any>) => Promise<TTypeOrmAwsConnectorModuleOptions> | TTypeOrmAwsConnectorModuleOptions;
}
