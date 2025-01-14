import { Module, DynamicModule, Global, Provider } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { IDatabaseModuleAsyncOptions } from "@shared/interface/database/module-async-options.interface";
import { DatabaseService } from "@modules/database/database.service";
import { RotatorService } from "@modules/database/rotator/rotator.service";
import { createDatabaseConfigProvider, DATABASE_CONFIG_PROVIDER } from "@shared/provider/database/database.provider";
import { IDatabaseModuleOptions } from "@shared/interface/database/module-options.interface";

@Global()
@Module({})
export class DatabaseModule {
	static register(config: IDatabaseModuleOptions): DynamicModule {
		const providers: Array<Provider> = [
			{
				provide: DATABASE_CONFIG_PROVIDER,
				useValue: config,
			},
			DatabaseService,
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
			module: DatabaseModule,
			imports,
			providers,
			exports: [DatabaseService, ...(isRotationEnabled ? [RotatorService] : [])],
		};
	}

	static async registerAsync(options: IDatabaseModuleAsyncOptions): Promise<DynamicModule> {
		const providers = [createDatabaseConfigProvider(options), DatabaseService];

		const imports = [...(options.imports || [])];

		const config = await options.useFactory(...(options.inject || []));
		const isRotationEnabled = config.rotation?.isEnabled;

		if (isRotationEnabled) {
			imports.push(ScheduleModule.forRoot());
			providers.push(RotatorService);
		}

		return {
			module: DatabaseModule,
			imports,
			providers,
			exports: [DatabaseService, ...(isRotationEnabled ? [RotatorService] : [])],
		};
	}
}
