import type { ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector";

import { TypeOrmAwsConnectorService } from "@modules/typeorm-aws-connector";
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector";
import { DataSource, DataSourceOptions, EntitySubscriberInterface, QueryRunner } from "typeorm";

@Injectable()
export class RotatorService implements OnModuleInit {
	private consecutiveFailures: number = 0;

	private isRotationInProgress: boolean = false;

	private readonly LOGGER: Logger = new Logger(RotatorService.name);

	// eslint-disable-next-line @elsikora/typescript/no-magic-numbers
	private readonly MAX_CONSECUTIVE_FAILURES: number = 3;

	constructor(
		private readonly dataSource: DataSource,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: ITypeOrmAwsConnectorConfig,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly connectorService: TypeOrmAwsConnectorService,
	) {}

	onModuleInit(): void {
		if (this.databaseConfig.rotation?.isEnabled) {
			const intervalMs: number = this.databaseConfig.rotation.intervalMs ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_ROTATION_INTERVAL;

			const interval: any = setInterval(() => {
				void this.safeRotateDatabaseConnection();
			}, intervalMs);

			this.schedulerRegistry.addInterval("db-rotation", interval);
			this.LOGGER.log(`DB credentials rotation interval started: ${String(intervalMs)} ms`);
		}
	}

	async rotateDatabaseConnection(): Promise<void> {
		this.LOGGER.log("Launching DB credentials rotation interval...");

		// First verify the current connection is actually healthy
		await this.validateConnectionHealth();

		// Backup existing configuration
		const currentOptions: DataSourceOptions = this.dataSource.options;
		const subscribers: Array<EntitySubscriberInterface> = [...this.dataSource.subscribers];

		// Get fresh credentials from AWS
		const freshOptions: DataSourceOptions = await this.connectorService.getTypeOrmOptions();

		const mergedOptions: DataSourceOptions = {
			...currentOptions,
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
			extra: {
				...currentOptions.extra,
			},
			// @ts-ignore
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
			host: freshOptions.host,
			// @ts-ignore
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
			password: freshOptions.password,
			// @ts-ignore
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-assignment
			username: freshOptions.username,
		};

		// Destroy old connection only if initialized
		if (this.dataSource.isInitialized) {
			await this.dataSource.destroy();
		}

		// Create and initialize a new data source with fresh credentials
		const newDataSource: DataSource = new DataSource(mergedOptions);
		await newDataSource.initialize();

		// Verify the new connection works by performing a simple query
		await this.verifyNewConnection(newDataSource);

		// Re-add subscribers
		for (const subscriber of subscribers) {
			newDataSource.subscribers.push(subscriber);
		}

		// Update the existing data source with new connection
		this.dataSource.setOptions(mergedOptions);
		// eslint-disable-next-line @elsikora/typescript/no-unsafe-member-access
		(this.dataSource as any).driver = newDataSource.driver;

		this.LOGGER.log("Rotation completed successfully!");
	}

	private async attemptEmergencyRecovery(): Promise<void> {
		try {
			this.LOGGER.log("Attempting emergency database connection recovery...");

			// Get fresh credentials and connection options from AWS
			const freshOptions: DataSourceOptions = await this.connectorService.getTypeOrmOptions();

			// If the data source is still initialized, destroy it first
			if (this.dataSource.isInitialized) {
				await this.dataSource.destroy();
			}

			// Create a completely new data source with fresh options
			const recoveryDataSource: DataSource = new DataSource({
				...freshOptions,
			});

			// Initialize the recovery data source
			await recoveryDataSource.initialize();

			// Transfer subscribers
			const subscribers: Array<EntitySubscriberInterface> = [...this.dataSource.subscribers];

			for (const subscriber of subscribers) {
				recoveryDataSource.subscribers.push(subscriber);
			}

			// Replace the driver and connection objects
			this.dataSource.setOptions(recoveryDataSource.options);
			// eslint-disable-next-line @elsikora/typescript/no-unsafe-member-access
			(this.dataSource as any).driver = recoveryDataSource.driver;

			// Reset failure counter after successful recovery
			this.consecutiveFailures = 0;
			this.LOGGER.log("Emergency recovery successful!");
		} catch (recoveryError) {
			this.LOGGER.error(`Emergency recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
		}
	}

	private async safeRotateDatabaseConnection(): Promise<void> {
		if (this.isRotationInProgress) {
			this.LOGGER.warn("Database rotation already in progress, skipping this cycle");

			return;
		}

		this.isRotationInProgress = true;

		try {
			await this.rotateDatabaseConnection();
			this.consecutiveFailures = 0;
		} catch (error) {
			this.consecutiveFailures++;
			this.LOGGER.error(`Database rotation failed: ${error instanceof Error ? error.message : String(error)}`);

			if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
				this.LOGGER.warn(`${String(this.consecutiveFailures)} consecutive rotation failures. Attempting emergency recovery...`);
				await this.attemptEmergencyRecovery();
			}
		} finally {
			this.isRotationInProgress = false;
		}
	}

	private async validateConnectionHealth(): Promise<void> {
		if (!this.dataSource.isInitialized) {
			this.LOGGER.warn("Current data source is not initialized, no health check needed");

			return;
		}

		try {
			// Test the current connection with a simple query
			const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
			await queryRunner.query("SELECT 1");
			await queryRunner.release();
			this.LOGGER.debug("Current connection is healthy");
		} catch (error) {
			this.LOGGER.warn(`Current connection health check failed: ${error instanceof Error ? error.message : String(error)}`);
			// We don't throw here, we'll continue with rotation to fix the issue
		}
	}

	private async verifyNewConnection(dataSource: DataSource): Promise<void> {
		try {
			const queryRunner: QueryRunner = dataSource.createQueryRunner();
			await queryRunner.query("SELECT 1");
			await queryRunner.release();
			this.LOGGER.debug("New connection verified successfully");
		} catch (error) {
			this.LOGGER.error(`New connection verification failed: ${error instanceof Error ? error.message : String(error)}`);

			throw new Error(`Failed to verify new database connection: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
