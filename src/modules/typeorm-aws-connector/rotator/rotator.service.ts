import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DataSource, DataSourceOptions, EntitySubscriberInterface, QueryRunner } from "typeorm";

import { TypeOrmAwsConnectorService } from "../typeorm-aws-connector.service";

@Injectable()
export class RotatorService implements OnModuleInit {
	private consecutiveFailures: number = 0;

	private isRotationInProgress: boolean = false;

	private readonly LOGGER: Logger;

	private readonly MAX_CONSECUTIVE_FAILURES: number = 3;

	constructor(
		private readonly dataSource: DataSource | undefined,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly connectorService: TypeOrmAwsConnectorService,
		private readonly rotationIntervalName: string,
	) {
		this.LOGGER = new Logger(`${RotatorService.name}:${this.rotationIntervalName}`);
	}

	onModuleInit(): void {
		const rotationConfig: { intervalMs: number; isEnabled: boolean } = this.connectorService.getRotationConfig();

		if (!rotationConfig.isEnabled) {
			return;
		}

		this.getRequiredDataSource();

		const interval: ReturnType<typeof setInterval> = setInterval(() => {
			void this.safeRotateDatabaseConnection();
		}, rotationConfig.intervalMs);

		this.schedulerRegistry.addInterval(this.rotationIntervalName, interval);
		this.LOGGER.log(`DB credentials rotation interval started: ${String(rotationConfig.intervalMs)} ms`);
	}

	async rotateDatabaseConnection(): Promise<void> {
		this.LOGGER.log("Launching DB credentials rotation interval...");

		const dataSource: DataSource = this.getRequiredDataSource();

		// First verify the current connection is actually healthy
		await this.validateConnectionHealth(dataSource);

		// Backup existing configuration
		const currentOptions: DataSourceOptions = dataSource.options;
		const subscribers: Array<EntitySubscriberInterface> = [...dataSource.subscribers];

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
		if (dataSource.isInitialized) {
			await dataSource.destroy();
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
		dataSource.setOptions(mergedOptions);
		this.replaceDataSourceDriver(dataSource, newDataSource);

		this.LOGGER.log("Rotation completed successfully!");
	}

	private async attemptEmergencyRecovery(): Promise<void> {
		try {
			this.LOGGER.log("Attempting emergency database connection recovery...");
			const dataSource: DataSource = this.getRequiredDataSource();

			// Get fresh credentials and connection options from AWS
			const freshOptions: DataSourceOptions = await this.connectorService.getTypeOrmOptions();

			// If the data source is still initialized, destroy it first
			if (dataSource.isInitialized) {
				await dataSource.destroy();
			}

			// Create a completely new data source with fresh options
			const recoveryDataSource: DataSource = new DataSource({
				...freshOptions,
			});

			// Initialize the recovery data source
			await recoveryDataSource.initialize();

			// Transfer subscribers
			const subscribers: Array<EntitySubscriberInterface> = [...dataSource.subscribers];

			for (const subscriber of subscribers) {
				recoveryDataSource.subscribers.push(subscriber);
			}

			// Replace the driver and connection objects
			dataSource.setOptions(recoveryDataSource.options);
			this.replaceDataSourceDriver(dataSource, recoveryDataSource);

			// Reset failure counter after successful recovery
			this.consecutiveFailures = 0;
			this.LOGGER.log("Emergency recovery successful!");
		} catch (recoveryError) {
			this.LOGGER.error(`Emergency recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
		}
	}

	private getRequiredDataSource(): DataSource {
		if (!this.dataSource) {
			throw new Error("Database rotation is enabled but TypeORM DataSource provider is not available.");
		}

		return this.dataSource;
	}

	private replaceDataSourceDriver(dataSource: DataSource, nextDataSource: DataSource): void {
		const mutableDataSource: { driver: DataSource["driver"] } & DataSource = dataSource;

		mutableDataSource.driver = nextDataSource.driver;
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

	private async validateConnectionHealth(dataSource: DataSource): Promise<void> {
		if (!dataSource.isInitialized) {
			this.LOGGER.warn("Current data source is not initialized, no health check needed");

			return;
		}

		try {
			// Test the current connection with a simple query
			const queryRunner: QueryRunner = dataSource.createQueryRunner();
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
