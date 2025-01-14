import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector/database.provider";
import { IAwsSecretsManagerItem } from "@shared/interface/aws/secrets-manager/item.interface";
import {ITypeOrmAwsConnectorConfig} from "@shared/interface/typeorm-aws-connector/config.interface";
import TYPEORM_AWS_CONNECTOR_CONSTANT from "@shared/constant/typeorm-aws-connector/constant";

@Injectable()
export class TypeormAwsConnectorService {
	private readonly logger = new Logger(TypeormAwsConnectorService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly parameterStoreConfigService: ParameterStoreConfigService,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: ITypeOrmAwsConnectorConfig,
	) {}

	async getCredentials(): Promise<IAwsSecretsManagerItem> {
		this.logger.debug("Asking credentials from AWS Secrets Manager...");

		const region = this.configService.get<string>("AWS_REGION");
		const client = new SecretsManagerClient({ region });

		const secretId = this.parameterStoreConfigService.get(`/${this.configService.get<string>("APPLICATION")}/elastic-beanstalk/${this.configService.get<string>("APPLICATION")}-reaper-api/aws-secrets-manager/database-credentials-secret-id`);

		const response = await client.send(
			new GetSecretValueCommand({
				SecretId: secretId,
				VersionStage: "AWSCURRENT",
			}),
		);

		this.logger.debug("Secrets was successfully loaded");

		return JSON.parse(response.SecretString ?? "{}") as IAwsSecretsManagerItem;
	}

	async getTypeOrmOptions() {
		const credentials = await this.getCredentials();

		const host = this.parameterStoreConfigService.get(`/${this.configService.get<string>("APPLICATION")}/elastic-beanstalk/${this.configService.get<string>("APPLICATION")}-reaper-api/aws-rds/host`);

		const options = {
			type: this.databaseConfig.type as any,
			host,
			port: this.databaseConfig.port,
			username: credentials.username,
			password: credentials.password,
			database: this.databaseConfig.databaseName,
			relationLoadStrategy: this.databaseConfig.relationLoadStrategy || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_RELATION_LOAD_STRATEGY,
			logging: this.databaseConfig.isVerbose || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_LOGGING,
			synchronize: this.databaseConfig.shouldSynchronize || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_SYNCHRONIZE,
			extra: {
				connectionTimeoutMillis: this.databaseConfig.connectionTimeoutMs || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_CONNECTION_TIMEOUT,
				idleTimeoutMillis: this.databaseConfig.idleTimeoutMs || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_IDLE_TIMEOUT,
				max: this.databaseConfig.poolSize || TYPEORM_AWS_CONNECTOR_CONSTANT.DB_POOL_SIZE,
			},
			entities: this.databaseConfig.entities,
		};

		this.logger.debug(`TypeORM options сформированы: ${JSON.stringify(options)}`);

		return options;
	}
}
