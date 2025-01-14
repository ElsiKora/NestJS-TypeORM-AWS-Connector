import type { ITypeOrmAwsConnectorModuleOptions } from "@shared/interface/typeorm-aws-connector/module-options.interface";

export interface ITypeOrmAwsConnectorModuleAsyncOptions {
	useFactory: (...arguments_: Array<any>) => Promise<ITypeOrmAwsConnectorModuleOptions> | ITypeOrmAwsConnectorModuleOptions;
	inject?: Array<any>;
	imports?: Array<any>;
	enableRotation?: boolean;
}
