import type { DynamicModule } from "@nestjs/common";

import { EEnvironment, ENamespace, ParameterStoreConfigModule } from "@elsikora/nestjs-aws-parameter-store-config";
import { TypeOrmAwsConnectorModule, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";
import { AuthorEntity } from "@entity/author.entity";
import { BookEntity } from "@entity/book.entity";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({})
export class AppModule {
	/**
	 * Registers the connector with the entities that import each other and wires it into TypeOrmModule.forRootAsync.
	 * @param {string} endpoint - AWS stub endpoint.
	 * @returns {DynamicModule} The application module.
	 */
	public static register(endpoint: string): DynamicModule {
		return {
			imports: [
				ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
				ParameterStoreConfigModule.register({
					application: "smoke",
					config: { credentials: { accessKeyId: "smoke", secretAccessKey: "smoke" }, endpoint, maxAttempts: 1, region: "us-east-1" },
					environment: EEnvironment.TEST,
					instanceName: "smoke-api",
					namespace: ENamespace.AWS_ECS_FARGATE,
				}),
				TypeOrmModule.forRootAsync({
					imports: [TypeOrmAwsConnectorModule.registerAsync({ useFactory: () => ({ entities: [AuthorEntity, BookEntity] }) })],
					inject: [TypeOrmAwsConnectorService],
					useFactory: async (connector: TypeOrmAwsConnectorService) => connector.getTypeOrmOptions(),
				}),
				TypeOrmModule.forFeature([AuthorEntity, BookEntity]),
			],
			module: AppModule,
		};
	}
}
