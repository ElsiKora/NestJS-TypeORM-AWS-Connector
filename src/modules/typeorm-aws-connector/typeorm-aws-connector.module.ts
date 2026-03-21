import type { OptionalFactoryDependency } from "@nestjs/common/interfaces";
import type { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector";
import type { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

import { DynamicModule, Module, Provider } from "@nestjs/common";
import { ScheduleModule, SchedulerRegistry } from "@nestjs/schedule";
import { DATABASE_CONFIG_PROVIDER, TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { createDatabaseConfigProvider, toTypeOrmAwsConnectorConfig } from "@shared/provider/typeorm-aws-connector";
import { DataSource } from "typeorm";

import { RotatorService } from "./rotator";
import { TypeOrmAwsConnectorService } from "./typeorm-aws-connector.service";

@Module({})
export class TypeOrmAwsConnectorModule {
	private static registrationSequence: number = 0;

	static register(config: TTypeOrmAwsConnectorModuleOptions): DynamicModule {
		TypeOrmAwsConnectorModule.registrationSequence += 1;

		const dataSourceDependency: OptionalFactoryDependency = {
			optional: true,
			token: config.dataSourceToken ?? DataSource,
		};
		const databaseConfig = toTypeOrmAwsConnectorConfig(config);
		const rotationIntervalName: string = `${TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_ROTATION_INTERVAL_NAME}:${String(TypeOrmAwsConnectorModule.registrationSequence)}`;

		const providers: Array<Provider> = [
			{
				provide: DATABASE_CONFIG_PROVIDER,
				useValue: databaseConfig,
			},
			TypeOrmAwsConnectorService,
			{
				inject: [dataSourceDependency, SchedulerRegistry, TypeOrmAwsConnectorService],
				provide: RotatorService,
				useFactory: (dataSource: DataSource | undefined, schedulerRegistry: SchedulerRegistry, connectorService: TypeOrmAwsConnectorService): RotatorService => new RotatorService(dataSource, schedulerRegistry, connectorService, rotationIntervalName),
			},
		];

		return {
			exports: [TypeOrmAwsConnectorService, RotatorService],
			imports: [ScheduleModule.forRoot()],
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}

	static registerAsync<TFactoryArguments extends Array<unknown> = Array<unknown>>(options: ITypeOrmAwsConnectorModuleAsyncOptions<TFactoryArguments>): DynamicModule {
		TypeOrmAwsConnectorModule.registrationSequence += 1;

		const dataSourceDependency: OptionalFactoryDependency = {
			optional: true,
			token: options.dataSourceToken ?? DataSource,
		};
		const rotationIntervalName: string = `${TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_ROTATION_INTERVAL_NAME}:${String(TypeOrmAwsConnectorModule.registrationSequence)}`;

		const providers: Array<Provider> = [
			createDatabaseConfigProvider(options),
			TypeOrmAwsConnectorService,
			{
				inject: [dataSourceDependency, SchedulerRegistry, TypeOrmAwsConnectorService],
				provide: RotatorService,
				useFactory: (dataSource: DataSource | undefined, schedulerRegistry: SchedulerRegistry, connectorService: TypeOrmAwsConnectorService): RotatorService => new RotatorService(dataSource, schedulerRegistry, connectorService, rotationIntervalName),
			},
		];

		return {
			exports: [TypeOrmAwsConnectorService, RotatorService],
			imports: [...(options.imports ?? []), ScheduleModule.forRoot()],
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}
}
