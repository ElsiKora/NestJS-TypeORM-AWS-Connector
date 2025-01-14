import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/database/database.provider";
import { IDatabaseConfig } from "@shared/interface/database/config.interface";
import { IAwsSecretsManagerItem } from "@shared/interface/aws/secrets-manager/item.interface";

@Injectable()
export class DatabaseService {
	private readonly logger = new Logger(DatabaseService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly parameterStoreConfigService: ParameterStoreConfigService,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: IDatabaseConfig,
	) {}

	async getCredentials(): Promise<IAwsSecretsManagerItem> {
		this.logger.debug("Asking credentials from AWS Secrets Manager...");

		const region = this.configService.get<string>("AWS_REGION");
		const client = new SecretsManagerClient({ region });

		const secretId = this.parameterStoreConfigService.get(`/${this.configService.get<string>("APPLICATION")}/elastic-beanstalk/${this.configService.get<string>("APPLICATION")}-reaper-api/aws-secrets-manager/database-credentials-secret-id`);

		console.log("SECRETID", secretId, `/${this.configService.get<string>("APPLICATION")}/elastic-beanstalk/${this.configService.get<string>("APPLICATION")}-reaper-api/aws-secrets-manager/database-credentials-secret-id`);

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
			logging: this.databaseConfig.isVerbose || false,
			synchronize: this.databaseConfig.shouldSynchronize || false,
			extra: {
				connectionTimeoutMillis: this.databaseConfig.connectionTimeoutMs || 30000,
				idleTimeoutMillis: this.databaseConfig.idleTimeoutMs || 30000,
				max: this.databaseConfig.poolSize || 10,
			},
			entities: this.databaseConfig.entities,
		};

		this.logger.debug(`TypeORM options сформированы: ${JSON.stringify(options)}`);

		return options;
	}
}
