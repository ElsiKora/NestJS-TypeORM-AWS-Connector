import { RotatorService } from "@modules/typeorm-aws-connector/rotator";
import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ITypeOrmAwsConnectorConfig, ITypeOrmAwsConnectorModuleAsyncOptions } from "@shared/interface/typeorm-aws-connector";
import { createDatabaseConfigProvider, DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector";
import { TTypeOrmAwsConnectorModuleOptions } from "@shared/type/typeorm-aws-connector";

import { TypeOrmAwsConnectorService } from "./typeorm-aws-connector.service";

@Global()
@Module({})
export class TypeOrmAwsConnectorModule {
	static register(config: TTypeOrmAwsConnectorModuleOptions): DynamicModule {
		// TypeOrmAwsConnectorService should come first to ensure it's available for injection
		const providers: Array<Provider> = [
			{
				provide: DATABASE_CONFIG_PROVIDER,
				useValue: config,
			},
			TypeOrmAwsConnectorService,
		];

		const isRotationEnabled: boolean | undefined = config.rotation?.isEnabled;
		const imports: Array<any> = [];

		if (isRotationEnabled) {
			imports.push(ScheduleModule.forRoot());
			// Make sure RotatorService is added after TypeOrmAwsConnectorService
			providers.push(RotatorService);
		}

		return {
			exports: [TypeOrmAwsConnectorService, ...(isRotationEnabled ? [RotatorService] : [])],
			imports,
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}

	static async registerAsync(options: ITypeOrmAwsConnectorModuleAsyncOptions): Promise<DynamicModule> {
		// Make sure order of providers allows proper dependency injection
		const providers: Array<Provider> = [createDatabaseConfigProvider(options), TypeOrmAwsConnectorService];

		// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
		const imports: Array<any> = [...(options.imports ?? [])];

		// eslint-disable-next-line @elsikora/typescript/no-unsafe-argument
		const config: ITypeOrmAwsConnectorConfig | Promise<TTypeOrmAwsConnectorModuleOptions> = await options.useFactory(...(options.inject ?? []));
		const isRotationEnabled: any = config.rotation?.isEnabled;

		if (isRotationEnabled) {
			imports.push(ScheduleModule.forRoot());
			// Add RotatorService last to ensure its dependencies are available
			providers.push(RotatorService);
		}

		return {
			exports: [TypeOrmAwsConnectorService, ...(isRotationEnabled ? [RotatorService] : [])],
			imports,
			module: TypeOrmAwsConnectorModule,
			providers,
		};
	}
}
