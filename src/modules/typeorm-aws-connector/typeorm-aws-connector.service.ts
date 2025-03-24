import type { ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector";

import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { EService, ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { IAwsSecretsManagerItem } from "@shared/interface/aws/secrets-manager";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector";
import { DataSourceOptions } from "typeorm";

@Injectable()
export class TypeOrmAwsConnectorService {
	private readonly LOGGER: Logger = new Logger(TypeOrmAwsConnectorService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly parameterStoreConfigService: ParameterStoreConfigService,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: ITypeOrmAwsConnectorConfig,
	) {}

	async getCredentials(): Promise<IAwsSecretsManagerItem> {
		this.LOGGER.debug("Asking credentials from AWS Secrets Manager...");

		const region: string | undefined = this.configService.get<string>("AWS_REGION");
		const client: SecretsManagerClient = new SecretsManagerClient({ region });

		const secretID: null | string = this.parameterStoreConfigService.get({ path: this.databaseConfig.secretID?.path ?? ["database-credentials-secret-id"], service: this.databaseConfig.secretID?.service ?? EService.AWS_SECRETS_MANAGER });

		if (!secretID) {
			throw new Error("Secret ID was not found in the AWS Parameter Store");
		}

		const response: GetSecretValueCommandOutput = await client.send(
			new GetSecretValueCommand({
				SecretId: secretID,
				VersionStage: "AWSCURRENT",
			}),
		);

		this.LOGGER.debug("Secrets was successfully loaded");

		return JSON.parse(response.SecretString ?? "{}") as IAwsSecretsManagerItem;
	}

	async getTypeOrmOptions(): Promise<DataSourceOptions> {
		const credentials: IAwsSecretsManagerItem = await this.getCredentials();

		const host: null | string = this.parameterStoreConfigService.get({ path: this.databaseConfig.host?.path ?? ["host"], service: this.databaseConfig.host?.service ?? EService.AWS_RDS });

		if (!host) {
			throw new Error("Host was not found in the AWS Parameter Store");
		}

		const options: DataSourceOptions = {
			database: this.databaseConfig.databaseName,
			entities: this.databaseConfig.entities,
			extra: {
				connectionTimeoutMillis: this.databaseConfig.connectionTimeoutMs ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_TIMEOUT,
				idleTimeoutMillis: this.databaseConfig.idleTimeoutMs ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_IDLE_TIMEOUT,
				max: this.databaseConfig.poolSize ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_POOL_SIZE,
			},
			host,
			// eslint-disable-next-line @elsikora/typescript/naming-convention
			logging: this.databaseConfig.isVerbose ?? TYPEORM_AWS_CONNECTOR_CONSTANT.IS_DATABASE_LOGGING_ENABLED,
			password: credentials.password,
			port: this.databaseConfig.port,
			relationLoadStrategy: this.databaseConfig.relationLoadStrategy ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_RELATION_LOAD_STRATEGY,
			// eslint-disable-next-line @elsikora/typescript/naming-convention
			synchronize: this.databaseConfig.shouldSynchronize ?? TYPEORM_AWS_CONNECTOR_CONSTANT.IS_DATABASE_SYNCHRONIZATION_ENABLED,
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
			type: this.databaseConfig.type as any,
			username: credentials.username,
		};

		this.LOGGER.debug(`TypeORM options were successfully created`);

		return options;
	}
}
