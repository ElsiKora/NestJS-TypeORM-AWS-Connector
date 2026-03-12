import { RotatorService } from "@modules/typeorm-aws-connector/rotator";
import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector";
import { createDatabaseConfigProvider, DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector";
import { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

import { TypeOrmAwsConnectorService } from "./typeorm-aws-connector.service";

@Global()
@Module({})
export class TypeOrmAwsConnectorModule {
	static register(config: TTypeOrmAwsConnectorModuleOptions): DynamicModule {
		const providers: Array<Provider> = [
			{
				provide: DATABASE_CONFIG_PROVIDER,
				useValue: config,
			},
			TypeOrmAwsConnectorService,
			RotatorService,
		];

		return {
			exports: [TypeOrmAwsConnectorService, RotatorService],
			imports: [ScheduleModule.forRoot()],
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}

	static registerAsync<TFactoryArguments extends Array<unknown> = Array<unknown>>(options: ITypeOrmAwsConnectorModuleAsyncOptions<TFactoryArguments>): DynamicModule {
		const providers: Array<Provider> = [createDatabaseConfigProvider(options), TypeOrmAwsConnectorService, RotatorService];

		return {
			exports: [TypeOrmAwsConnectorService, RotatorService],
			imports: [...(options.imports ?? []), ScheduleModule.forRoot()],
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}
}
