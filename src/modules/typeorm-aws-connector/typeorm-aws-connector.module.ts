import { Module, DynamicModule, Global, Provider } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector/module-async-options.interface";
import { TypeOrmAwsConnectorService } from "@modules/typeorm-aws-connector/typeorm-aws-connector.service";
import { RotatorService } from "@modules/typeorm-aws-connector/rotator/rotator.service";
import { createDatabaseConfigProvider, DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector/database.provider";
import { ITypeOrmAwsConnectorModuleOptions } from "@shared/interface/typeorm-aws-connector/module-options.interface";

@Global()
@Module({})
export class TypeOrmAwsConnectorModule {
	static register(config: ITypeOrmAwsConnectorModuleOptions): DynamicModule {
		const providers: Array<Provider> = [
			{
				provide: DATABASE_CONFIG_PROVIDER,
				useValue: config,
			},
			TypeOrmAwsConnectorService,
		];

		const isRotationEnabled = config.rotation?.isEnabled;
		const imports: Array<any> = [];

		if (isRotationEnabled) {
			imports.push(ScheduleModule.forRoot());
			providers.push({
				provide: RotatorService,
				useClass: RotatorService,
			});
		}

		return {
			module: TypeOrmAwsConnectorModule,
			imports,
			providers,
			exports: [TypeOrmAwsConnectorService, ...(isRotationEnabled ? [RotatorService] : [])],
		};
	}

	static async registerAsync(options: ITypeOrmAwsConnectorModuleAsyncOptions): Promise<DynamicModule> {
		const providers = [createDatabaseConfigProvider(options), TypeOrmAwsConnectorService];

		const imports = [...(options.imports || [])];

		const config = await options.useFactory(...(options.inject || []));
		const isRotationEnabled = config.rotation?.isEnabled;

		if (isRotationEnabled) {
			imports.push(ScheduleModule.forRoot());
			providers.push(RotatorService);
		}

		return {
			module: TypeOrmAwsConnectorModule,
			imports,
			providers,
			exports: [TypeOrmAwsConnectorService, ...(isRotationEnabled ? [RotatorService] : [])],
		};
	}
}
