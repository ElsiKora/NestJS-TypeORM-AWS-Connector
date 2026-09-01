import type { IAwsDatabaseCredentialsSecret } from "@shared/interface/aws";
import type { IStructuredLookup, ITypeOrmAwsConnectorConfig, ITypeOrmAwsConnectorParameterStoreConfigReader } from "@shared/interface/typeorm-aws-connector";
import type { TTypeOrmAwsConnectorResolvedRotationConfig } from "@shared/type/typeorm-aws-connector";
import type { DataSourceOptions } from "typeorm";

import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { ParameterStoreConfigService } from "@elsikora/nestjs-aws-parameter-store-config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CONFIG_PROVIDER, TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { EDatabaseType, ERelationLoadStrategy } from "@shared/enum";
import { FormatErrorEvidence } from "@shared/utility/error-evidence.utility";

@Injectable()
export class TypeOrmAwsConnectorService {
	private readonly LOGGER: Logger = new Logger(TypeOrmAwsConnectorService.name);

	constructor(
		private readonly configService: ConfigService,
		@Inject(ParameterStoreConfigService)
		private readonly parameterStoreConfigService: ITypeOrmAwsConnectorParameterStoreConfigReader,
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
			password: rawPassword === undefined ? this.readRequiredSecretString("password", credentialsSecret.password) : this.parseRawStringValue("password", rawPassword),
			username: rawUsername === undefined ? this.readRequiredSecretString("username", credentialsSecret.username) : this.parseRawStringValue("username", rawUsername),
		};
	}

	getRotationConfig(): TTypeOrmAwsConnectorResolvedRotationConfig {
		const intervalMs: number = this.readOptionalNumberFromConfigOrSsm("rotationIntervalMs", this.databaseConfig.rotation?.intervalMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_ROTATION_INTERVAL);
		const isEnabled: boolean = this.readOptionalBooleanFromConfigOrSsm("rotationIsEnabled", this.databaseConfig.rotation?.isEnabled ?? null, false);
		const shutdownDrainTimeoutMs: number | undefined = this.readOptionalPositiveNumberFromConfigOrSsm("rotationShutdownDrainTimeoutMs", this.databaseConfig.rotation?.shutdownDrainTimeoutMs);

		this.validatePositiveNumber("rotationIntervalMs", intervalMs);

		if (isEnabled) {
			if (shutdownDrainTimeoutMs === undefined) {
				throw new Error(`Value for "${this.getFieldLabel("rotationShutdownDrainTimeoutMs")}" was not found in AWS Systems Manager Parameter Store.`);
			}

			return {
				intervalMs,
				isEnabled: true,
				onEvent: this.databaseConfig.rotation?.onEvent,
				shutdownDrainTimeoutMs,
			};
		}

		return {
			intervalMs,
			isEnabled: false,
			onEvent: this.databaseConfig.rotation?.onEvent,
			shutdownDrainTimeoutMs,
		};
	}

	async getTypeOrmOptions(): Promise<DataSourceOptions> {
		const connectionTimeoutMs: number = this.readOptionalNumberFromConfigOrSsm("connectionTimeoutMs", this.databaseConfig.connectionTimeoutMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_TIMEOUT);
		const credentials: IAwsDatabaseCredentialsSecret = await this.getCredentials();
		const databaseName: string = this.readRequiredStringFromConfigOrSsm("databaseName", this.databaseConfig.databaseName);
		const host: string = this.readRequiredStringFromConfigOrSsm("host", this.databaseConfig.host);
		const idleTimeoutMs: number = this.readOptionalNumberFromConfigOrSsm("idleTimeoutMs", this.databaseConfig.idleTimeoutMs, TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_IDLE_TIMEOUT);
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

			logging: false,
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
			throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}": "path" must be a non-empty string array.`);
		}

		for (const segment of path) {
			if (typeof segment !== "string" || !segment.trim() || segment.includes("/")) {
				throw new Error(`Invalid lookup config for "${this.getFieldLabel(field)}": every "path" segment must be a non-empty string without "/".`);
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
		this.LOGGER.debug("Fetching credentials secret from AWS Secrets Manager...");

		let response: GetSecretValueCommandOutput;

		try {
			response = await this.getCredentialsSecretClient().send(
				new GetSecretValueCommand({
					SecretId: secretId,
					VersionStage: TYPEORM_AWS_CONNECTOR_CONSTANT.SECRETS_MANAGER_CURRENT_VERSION_STAGE,
				}),
			);
		} catch (error) {
			const errorEvidence: string = FormatErrorEvidence(error);

			if (errorEvidence === "errorType=ResourceNotFoundException" || errorEvidence.startsWith("errorType=ResourceNotFoundException ")) {
				throw new Error(`Secret in AWS Secrets Manager was not found. ${errorEvidence}`, { cause: error });
			}

			throw new Error(`Failed to load secret from AWS Secrets Manager. ${errorEvidence}`, { cause: error });
		}

		if (!response.SecretString) {
			throw new Error("Secret in AWS Secrets Manager does not contain a string payload.");
		}

		try {
			return JSON.parse(response.SecretString) as IAwsDatabaseCredentialsSecret;
		} catch (error) {
			throw new Error(`Secret in AWS Secrets Manager contains invalid JSON. ${FormatErrorEvidence(error)}`, { cause: error });
		}
	}

	private getCredentialsSecretClient(): SecretsManagerClient {
		const region: string | undefined = this.configService.get<string>("AWS_REGION");

		return new SecretsManagerClient({ region });
	}

	private getFieldLabel(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.SSM_FIELD_LABELS): string {
		return TYPEORM_AWS_CONNECTOR_CONSTANT.SSM_FIELD_LABELS[field];
	}

	private getSsmValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS): { lookup: IStructuredLookup; value: null | string } {
		const lookup: IStructuredLookup = this.buildLookup(field);

		try {
			return {
				lookup,
				value: this.parameterStoreConfigService.get(lookup),
			};
		} catch (error) {
			throw new Error(`Failed to resolve AWS Systems Manager Parameter Store value. ${FormatErrorEvidence(error)}`, { cause: error });
		}
	}

	private parseBooleanValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS, value: boolean | string): boolean {
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

		throw new Error(`Invalid boolean value for "${this.getFieldLabel(field)}".`);
	}

	private parseDatabaseTypeValue(value: EDatabaseType | string): EDatabaseType {
		const normalizedValue: string = typeof value === "string" ? value.trim().toLowerCase() : value;

		switch (normalizedValue) {
			case "mysql": {
				return EDatabaseType.MYSQL;
			}

			case "postgres": {
				return EDatabaseType.POSTGRES;
			}

			default: {
				throw new Error('Invalid string value for "type".');
			}
		}
	}

	private parseNumberValue(field: keyof typeof TYPEORM_AWS_CONNECTOR_CONSTANT.CANONICAL_SSM_LOOKUPS, value: number | string): number {
		if (typeof value === "number") {
			if (Number.isFinite(value) && Number.isInteger(value)) {
				return value;
			}

			throw new Error(`Invalid number value for "${this.getFieldLabel(field)}".`);
		}

		const normalizedValue: string = this.parseRawStringValue(this.getFieldLabel(field), value);
		const parsedValue: number = Number(normalizedValue);

		if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
			throw new TypeError(`Invalid number value for "${this.getFieldLabel(field)}".`);
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

	private parseRelationLoadStrategyValue(value: ERelationLoadStrategy | string): ERelationLoadStrategy {
		const normalizedValue: string = typeof value === "string" ? value.trim().toLowerCase() : value;

		switch (normalizedValue) {
			case "join": {
				return ERelationLoadStrategy.JOIN;
			}

			case "query": {
				return ERelationLoadStrategy.QUERY;
			}

			default: {
				throw new Error('Invalid string value for "relationLoadStrategy".');
			}
		}
	}

	private readOptionalBooleanFromConfigOrSsm(field: "rotationIsEnabled" | "shouldSynchronize", rawValue: boolean | null = null, defaultValue: boolean): boolean {
		if (rawValue !== null) {
			return this.parseBooleanValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseBooleanValue(field, ssmValue.value);
	}

	private readOptionalNumberFromConfigOrSsm(field: "connectionTimeoutMs" | "idleTimeoutMs" | "poolSize" | "rotationIntervalMs", rawValue: number | undefined, defaultValue: number): number {
		if (rawValue !== undefined) {
			return this.parseNumberValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseNumberValue(field, ssmValue.value);
	}

	private readOptionalPositiveNumberFromConfigOrSsm(field: "rotationShutdownDrainTimeoutMs", rawValue: number | undefined): number | undefined {
		if (rawValue !== undefined) {
			const value: number = this.parseNumberValue(field, rawValue);

			this.validatePositiveNumber(field, value);

			return value;
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			return undefined;
		}

		const value: number = this.parseNumberValue(field, ssmValue.value);

		this.validatePositiveNumber(field, value);

		return value;
	}

	private readOptionalRelationLoadStrategyFromConfigOrSsm(rawValue: ERelationLoadStrategy | undefined, defaultValue: ERelationLoadStrategy): ERelationLoadStrategy {
		if (rawValue !== undefined) {
			return this.parseRelationLoadStrategyValue(rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue("relationLoadStrategy");

		if (ssmValue.value === null) {
			return defaultValue;
		}

		return this.parseRelationLoadStrategyValue(ssmValue.value);
	}

	private readRequiredDatabaseTypeFromConfigOrSsm(rawValue: EDatabaseType | undefined): EDatabaseType {
		if (rawValue !== undefined) {
			return this.parseDatabaseTypeValue(rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue("type");

		if (ssmValue.value === null) {
			throw new Error('Value for "type" was not found in AWS Systems Manager Parameter Store.');
		}

		return this.parseDatabaseTypeValue(ssmValue.value);
	}

	private readRequiredNumberFromConfigOrSsm(field: "port", rawValue: number | undefined): number {
		if (rawValue !== undefined) {
			return this.parseNumberValue(field, rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			throw new Error(`Value for "${this.getFieldLabel(field)}" was not found in AWS Systems Manager Parameter Store.`);
		}

		return this.parseNumberValue(field, ssmValue.value);
	}

	private readRequiredSecretString(field: "password" | "username", value: string | undefined): string {
		if (typeof value !== "string") {
			throw new TypeError(`Credentials secret is missing required field "${field}".`);
		}

		return this.parseRawStringValue(field, value);
	}

	private readRequiredStringFromConfigOrSsm(field: "databaseName" | "host" | "secretId", rawValue: string | undefined): string {
		if (rawValue !== undefined) {
			return this.parseRawStringValue(this.getFieldLabel(field), rawValue);
		}

		const ssmValue: { lookup: IStructuredLookup; value: null | string } = this.getSsmValue(field);

		if (ssmValue.value === null) {
			throw new Error(`Value for "${this.getFieldLabel(field)}" was not found in AWS Systems Manager Parameter Store.`);
		}

		return this.parseRawStringValue(this.getFieldLabel(field), ssmValue.value);
	}

	private validatePositiveNumber(field: "rotationIntervalMs" | "rotationShutdownDrainTimeoutMs", value: number): void {
		if (value > 0) {
			return;
		}

		throw new RangeError(`Invalid number value for "${this.getFieldLabel(field)}". Value must be a positive integer.`);
	}
}
