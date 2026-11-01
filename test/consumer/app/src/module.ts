import type { IParameterStoreConfigProperties } from "@elsikora/nestjs-aws-parameter-store-config";
import type { ITypeOrmAwsConnectorConfig, TTypeOrmAwsConnectorRotationEvent } from "@elsikora/nestjs-typeorm-aws-connector";
import type { DynamicModule } from "@nestjs/common";

import { EEnvironment, ENamespace, ParameterStoreConfigModule } from "@elsikora/nestjs-aws-parameter-store-config";
import { ETypeOrmAwsConnectorRotationEvent, TypeOrmAwsConnectorModule, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { NoteEntity } from "./note.entity.js";

const AWS_ENDPOINT: string = "AWS_ENDPOINT";

export const retiredGenerations: Array<number> = [];

@Module({})
class EndpointModule {
	public static register(endpoint: string): DynamicModule {
		return { exports: [AWS_ENDPOINT], module: EndpointModule, providers: [{ provide: AWS_ENDPOINT, useValue: endpoint }] };
	}
}

@Module({})
export class AppModule {
	/**
	 * Registers the connector with TypeOrmAwsConnectorModule.register and wires it into TypeOrmModule.forRootAsync.
	 * @param {string} endpoint - AWS stub endpoint.
	 * @returns {DynamicModule} The application module.
	 */
	public static withRegister(endpoint: string): DynamicModule {
		return createApplicationModule(endpoint, TypeOrmAwsConnectorModule.register(createConnectorConfig()));
	}

	/**
	 * Registers the connector with TypeOrmAwsConnectorModule.registerAsync and an injected factory argument.
	 * @param {string} endpoint - AWS stub endpoint.
	 * @returns {DynamicModule} The application module.
	 */
	public static withRegisterAsync(endpoint: string): DynamicModule {
		return createApplicationModule(
			endpoint,
			TypeOrmAwsConnectorModule.registerAsync<[string]>({
				imports: [EndpointModule.register(endpoint)],
				inject: [AWS_ENDPOINT],
				useFactory: (injectedEndpoint: string) => {
					if (!injectedEndpoint.startsWith("http://127.0.0.1:")) {
						throw new Error(`Unexpected injected endpoint ${injectedEndpoint}`);
					}

					return createConnectorConfig();
				},
			}),
		);
	}
}

/**
 * Builds the application module around one connector registration.
 * @param {string} endpoint - AWS stub endpoint.
 * @param {DynamicModule} connectorModule - The registered connector module.
 * @returns {DynamicModule} The application module.
 */
function createApplicationModule(endpoint: string, connectorModule: DynamicModule): DynamicModule {
	return {
		imports: [
			ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
			ParameterStoreConfigModule.register(createParameterStoreProperties(endpoint)),
			TypeOrmModule.forRootAsync({
				imports: [connectorModule],
				inject: [TypeOrmAwsConnectorService],
				useFactory: async (connector: TypeOrmAwsConnectorService) => connector.getTypeOrmOptions(),
			}),
			TypeOrmModule.forFeature([NoteEntity]),
		],
		module: AppModule,
	};
}

/**
 * Builds the connector options: everything except the entities comes from the parameter store and the secret.
 * @returns {ITypeOrmAwsConnectorConfig} The connector options.
 */
function createConnectorConfig(): ITypeOrmAwsConnectorConfig {
	return {
		entities: [NoteEntity],
		rotation: {
			onEvent: (event: TTypeOrmAwsConnectorRotationEvent) => {
				// The union narrows on type, which checks the published declarations
				if (event.type === ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED) {
					retiredGenerations.push(event.generation);
				}
			},
		},
	};
}

/**
 * Builds the parameter store module defaults that point the SSM client at the stub.
 * @param {string} endpoint - AWS stub endpoint.
 * @returns {IParameterStoreConfigProperties} The module properties.
 */
function createParameterStoreProperties(endpoint: string): IParameterStoreConfigProperties {
	return {
		application: "smoke",
		config: { credentials: { accessKeyId: "smoke", secretAccessKey: "smoke" }, endpoint, maxAttempts: 1, region: "us-east-1" },
		environment: EEnvironment.TEST,
		instanceName: "smoke-api",
		namespace: ENamespace.AWS_ECS_FARGATE,
	};
}
