import type { InjectionToken } from "@nestjs/common";
import type { ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector/config.interface";

export type TTypeOrmAwsConnectorModuleOptions = {
	dataSourceToken?: InjectionToken;
} & ITypeOrmAwsConnectorConfig;
