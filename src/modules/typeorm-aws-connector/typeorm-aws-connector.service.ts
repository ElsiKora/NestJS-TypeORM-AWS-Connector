import type { IAwsDatabaseCredentialsSecret } from "@shared/interface/aws";
import type { IStructuredLookup, ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector";
import type { DataSourceOptions } from "typeorm";

import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CONFIG_PROVIDER, TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { EDatabaseType, ERelationLoadStrategy } from "@shared/enum";

@Injectable()
export class TypeOrmAwsConnectorService {
	private readonly LOGGER: Logger = new Logger(TypeOrmAwsConnectorService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly parameterStoreConfigService: ParameterStoreConfigService,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: ITypeOrmAwsConnectorConfig,
	) {}

	async getCredentials(): Promise<IAwsDatabaseCredentialsSecret> {
		const rawUsername: string | undefined = this.databaseConfig.username;
		const rawPassword: string | undefined = this.databaseConfig.password;

		if (rawUsername !== undefined && rawPassword !== undefined) {
			return {
				password: this.parseRawStringValue("password", rawPassword),
				username: this.parseRawStringValue("username", rawUsername),
			};
		}

		this.LOGGER.debug("Resolving database credentials...");

		const secretId: string = this.readRequiredStringFromConfigOrSsm("secretId", this.databaseConfig.secretId);
		const credentialsSecret: IAwsDatabaseCredentialsSecret = await this.getCredentialsSecret(secretId);

		return {
			password: rawPassword === undefined ? this.readRequiredSecretString("password", credentialsSecret.password, secretId) : this.parseRawStringValue("password", rawPassword),
			username: rawUsername === undefined ? this.readRequiredSecretString("username", credentialsSecret.username, secretId) : this.parseRawStringValue("username", rawUsername),
		};
	}

	getRotationConfig(): { intervalMs: number; isEnabled: boolean } {
		return {
			intervalMs: this.readOptionalNumberFromConfigOrSsm("rotationIntervalMs", this.databaseConfig.rotation?.intervalMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_ROTATION_INTERVAL),
			isEnabled: this.readOptionalBooleanFromConfigOrSsm("rotationIsEnabled", this.databaseConfig.rotation?.isEnabled ?? null, false),
		};
	}

	async getTypeOrmOptions(): Promise<DataSourceOptions> {
		const connectionTimeoutMs: number = this.readOptionalNumberFromConfigOrSsm("connectionTimeoutMs", this.databaseConfig.connectionTimeoutMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_TIMEOUT);
		const credentials: IAwsDatabaseCredentialsSecret = await this.getCredentials();
		const databaseName: string = this.readRequiredStringFromConfigOrSsm("databaseName", this.databaseConfig.databaseName);
		const host: string = this.readRequiredStringFromConfigOrSsm("host", this.databaseConfig.host);
		const idleTimeoutMs: number = this.readOptionalNumberFromConfigOrSsm("idleTimeoutMs", this.databaseConfig.idleTimeoutMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_IDLE_TIMEOUT);
		const isVerbose: boolean = this.readOptionalBooleanFromConfigOrSsm("isVerbose", this.databaseConfig.isVerbose ?? null, TYPEORM_AWS_CONNECTOR_CONSTANT.IS_DATABASE_LOGGING_ENABLED);
		const poolSize: number = this.readOptionalNumberFromConfigOrSsm("poolSize", this.databaseConfig.poolSize, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_POOL_SIZE);
		const port: number = this.readRequiredNumberFromConfigOrSsm("port", this.databaseConfig.port);
		const relationLoadStrategy: ERelationLoadStrategy = this.readOptionalRelationLoadStrategyFromConfigOrSsm(this.databaseConfig.relationLoadStrategy, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_RELATION_LOAD_STRATEGY);

		const shouldSynchronize: boolean = this.readOptionalBooleanFromConfigOrSsm("shouldSynchronize", this.databaseConfig.shouldSynchronize ?? null, TYPEORM_AWS_CONNECTOR_CONSTANT.IS_DATABASE_SYNCHRONIZATION_ENABLED);
		const type: EDatabaseType = this.readRequiredDatabaseTypeFromConfigOrSsm(this.databaseConfig.type);

		const options: DataSourceOptions = {
			database: databaseName,
			entities: this.databaseConfig.entities,
			extra: {
				connectionTimeoutMillis: connectionTimeoutMs,
				idleTimeoutMillis: idleTimeoutMs,
				max: poolSize,
			},
			host,

			logging: isVerbose,
			password: credentials.password,
			port,
			relationLoadStrategy,

			synchronize: shouldSynchronize,
			type,
			username: credentials.username,
		};

		this.LOGGER.debug("TypeORM options were successfully created");

		return options;
	}

	private buildLookup(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS): IStructuredLookup {
		const canonicalLookup: IStructuredLookup = TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS[field];
		const fieldLookup: IStructuredLookup | undefined = this.databaseConfig.ssmLookups?.[field];

		if (fieldLookup && !("path" in fieldLookup)) {
			throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}": "path" is required when "ssmLookups.${field}" is provided.`);
		}

		const path: Array<string> = fieldLookup ? fieldLookup.path : canonicalLookup.path;

		if (!Array.isArray(path) || path.length === 0) {
			throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}": "path" must be a non-empty string array. Lookup: ${JSON.stringify(fieldLookup ?? canonicalLookup)}`);
		}

		for (const segment of path) {
			if (typeof segment !== "string" || !segment.trim() || segment.includes("/")) {
				throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}": every "path" segment must be a non-empty string without "/". Lookup: ${JSON.stringify(fieldLookup ?? canonicalLookup)}`);
			}
		}

		return {
			application: fieldLookup?.application ?? canonicalLookup.application ?? this.databaseConfig.ssmLookupDefaults?.application,
			environment: fieldLookup?.environment ?? canonicalLookup.environment ?? this.databaseConfig.ssmLookupDefaults?.environment,
			instanceName: fieldLookup?.instanceName ?? canonicalLookup.instanceName ?? this.databaseConfig.ssmLookupDefaults?.instanceName,
			namespace: fieldLookup?.namespace ?? canonicalLookup.namespace ?? this.databaseConfig.ssmLookupDefaults?.namespace,
			path,
		};
	}

	private async getCredentialsSecret(secretId: string): Promise<IAwsDatabaseCredentialsSecret> {
		this.LOGGER.debug(`Fetching credentials secret "${secretId}" from AWS Secrets Manager...`);

		let response: GetSecretValueCommandOutput;

		try {
			response = await this.getCredentialsSecretClient().send(
				new GetSecretValueCommand({
					SecretId: secretId,
					VersionStage: TYPEORM_AWS_CONNECTOR_CONSTANT.SECRETS_MANAGER_CURRENT_VERSION_STAGE,
				}),
			);
		} catch (error) {
			const errorName: string | undefined = error instanceof Error ? error.name : undefined;
			const message: string = error instanceof Error ? error.message : String(error);

			if (errorName === "ResourceNotFoundException") {
				throw new Error(`Secret in AWS Secrets Manager was not found for "secret-id" value "${secretId}".`);
			}

			throw new Error(`Failed to load secret from AWS Secrets Manager for "secret-id" value "${secretId}": ${message}`);
		}

		if (!response.SecretString) {
			throw new Error(`Secret in AWS Secrets Manager for "secret-id" value "${secretId}" does not contain a string payload.`);
		}

		try {
			return JSON.parse(response.SecretString) as IAwsDatabaseCredentialsSecret;
		} catch (error) {
			throw new Error(`Secret in AWS Secrets Manager for "secret-id" value "${secretId}" contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private getCredentialsSecretClient(): SecretsManagerClient {
		const region: string | undefined = this.configService.get<string>("AWS_REGION");

		return new SecretsManagerClient({ region });
	}

	private getFieldLabel(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.SSM_FIELD_LABELS): string {
		return TYPEORM_AWS_CONNECTOR_CONSTANT.SSM_FIELD_LABELS[field];
	}

	private getLookupSuffix(lookup?: IStructuredLookup): string {
		if (lookup === undefined) {
			return "";
		}

		return ` Lookup: ${JSON.stringify(lookup)}.`;
	}

	private getSsmValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS): { lookup: IStructuredLookup; value: null | string } {
		const lookup: IStructuredLookup = this.buildLookup(field);

		try {
			return {
				lookup,
				value: this.parameterStoreConfigService.get(lookup),
			};
		} catch (error) {
			throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}". Lookup: ${JSON.stringify(lookup)}. ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private parseBooleanValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS, value: boolean | string, lookup?: IStructuredLookup): boolean {
		if (typeof value === "boolean") {
			return value;
		}

		const normalizedValue: string = this.parseRawStringValue(this.getFieldLabel(field), value);

		if (normalizedValue === "true") {
			return true;
		}

		if (normalizedValue === "false") {
			return false;
		}

		throw new Error(`Invalid boolean value for "${this.getFieldLabel(field)}": "${value}".${this.getLookupSuffix(lookup)}`);
	}

	private parseDatabaseTypeValue(value: EDatabaseType | string, lookup?: IStructuredLookup): EDatabaseType {
		const normalizedValue: string = typeof value === "string" ? value.trim().toLowerCase() : value;

		switch (normalizedValue) {
			case "mysql": {
				return EDatabaseType.MYSQL;
			}

			case "postgres": {
				return EDatabaseType.POSTGRES;
			}

			default: {
				throw new Error(`Invalid string value for "type": "${value}".${this.getLookupSuffix(lookup)}`);
			}
		}
	}

	private parseNumberValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS, value: number | string, lookup?: IStructuredLookup): number {
		if (typeof value === "number") {
			if (Number.isFinite(value) && Number.isInteger(value)) {
				return value;
			}

			throw new Error(`Invalid number value for "${this.getFieldLabel(field)}": "${String(value)}".`);
		}

		const normalizedValue: string = this.parseRawStringValue(this.getFieldLabel(field), value);
		const parsedValue: number = Number(normalizedValue);

		if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
			throw new TypeError(`Invalid number value for "${this.getFieldLabel(field)}": "${value}".${this.getLookupSuffix(lookup)}`);
		}

		return parsedValue;
	}

	private parseRawStringValue(field: string, value: string): string {
		const normalizedValue: string = value.trim();

		if (!normalizedValue) {
			throw new Error(`Invalid string value for "${field}": value must be a non-empty string.`);
		}

		return normalizedValue;
	}

	private parseRelationLoadStrategyValue(value: ERelationLoadStrategy | string, lookup?: IStructuredLookup): ERelationLoadStrategy {
		const normalizedValue: string = typeof value === "string" ? value.trim().toLowerCase() : value;

		switch (normalizedValue) {
			case "join": {
				return ERelationLoadStrategy.JOIN;
			}

			case "query": {
				return ERelationLoadStrategy.QUERY;
			}

			default: {
				throw new Error(`Invalid string value for "relationLoadStrategy": "${value}".${this.getLookupSuffix(lookup)}`);
			}
		}
	}

	private readOptionalBooleanFromConfigOrSsm(field: "isVerbose" | "rotationIsEnabled" | "shouldSynchronize", rawValue: boolean | null = null, defaultValue: boolean): boolean {
		if (rawValue !== null) {
			return this.parseBooleanValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseBooleanValue(field, ssmValue.value, ssmValue.lookup);
	}

	private readOptionalNumberFromConfigOrSsm(field: "connectionTimeoutMs" | "idleTimeoutMs" | "poolSize" | "rotationIntervalMs", rawValue: number | undefined, defaultValue: number): number {
		if (rawValue !== undefined) {
			return this.parseNumberValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseNumberValue(field, ssmValue.value, ssmValue.lookup);
	}

	private readOptionalRelationLoadStrategyFromConfigOrSsm(rawValue: ERelationLoadStrategy | undefined, defaultValue: ERelationLoadStrategy): ERelationLoadStrategy {
		if (rawValue !== undefined) {
			return this.parseRelationLoadStrategyValue(rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue("relationLoadStrategy");

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseRelationLoadStrategyValue(ssmValue.value, ssmValue.lookup);
	}

	private readRequiredDatabaseTypeFromConfigOrSsm(rawValue: EDatabaseType | undefined): EDatabaseType {
		if (rawValue !== undefined) {
			return this.parseDatabaseTypeValue(rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue("type");

		if (ssmValue.value === null) {
			throw new Error(`Value for "type" was not found in AWS Systems Manager Parameter Store. Lookup: ${JSON.stringify(ssmValue.lookup)}.`);
		}

		return this.parseDatabaseTypeValue(ssmValue.value, ssmValue.lookup);
	}

	private readRequiredNumberFromConfigOrSsm(field: "port", rawValue: number | undefined): number {
		if (rawValue !== undefined) {
			return this.parseNumberValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			throw new Error(`Value for "${this.getFieldLabel(field)}" was not found in AWS Systems Manager Parameter Store. Lookup: ${JSON.stringify(ssmValue.lookup)}.`);
		}

		return this.parseNumberValue(field, ssmValue.value, ssmValue.lookup);
	}

	private readRequiredSecretString(field: "password" | "username", value: string | undefined, secretId: string): string {
		if (typeof value !== "string") {
			throw new TypeError(`Credentials secret "${secretId}" is missing required field "${field}".`);
		}

		return this.parseRawStringValue(field, value);
	}

	private readRequiredStringFromConfigOrSsm(field: "databaseName" | "host" | "secretId", rawValue: string | undefined): string {
		if (rawValue !== undefined) {
			return this.parseRawStringValue(this.getFieldLabel(field), rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			throw new Error(`Value for "${this.getFieldLabel(field)}" was not found in AWS Systems Manager Parameter Store. Lookup: ${JSON.stringify(ssmValue.lookup)}.`);
		}

		return this.parseRawStringValue(this.getFieldLabel(field), ssmValue.value);
	}
}
