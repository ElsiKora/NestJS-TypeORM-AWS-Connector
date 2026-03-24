import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DataSource, DataSourceOptions, QueryRunner } from "typeorm";

import { TypeOrmAwsConnectorService } from "../typeorm-aws-connector.service";

type TMutableDriver = {
	connection: DataSource;
	options: DataSourceOptions;
} & DataSource["driver"];

type TQueryRunnerMode = Parameters<DataSource["createQueryRunner"]>[0];

type TRetiredDriver = {
	driver: TMutableDriver;
	generation: number;
};

@Injectable()
export class RotatorService implements OnModuleDestroy, OnModuleInit {
	private readonly activeQueryRunnerCountsByGeneration: Map<number, number> = new Map<number, number>();

	private consecutiveFailures: number = 0;

	private currentDriverGeneration: number = 0;

	private isDataSourceTrackingInstalled: boolean = false;

	private isRotationInProgress: boolean = false;

	private readonly LOGGER: Logger;

	private readonly MAX_CONSECUTIVE_FAILURES: number = 3;

	private retiredDriverDisposal: Promise<void> = Promise.resolve();

	private retiredDrivers: Array<TRetiredDriver> = [];

	constructor(
		private readonly dataSource: DataSource | undefined,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly connectorService: TypeOrmAwsConnectorService,
		private readonly rotationIntervalName: string,
	) {
		this.LOGGER = new Logger(`${RotatorService.name}:${this.rotationIntervalName}`);
	}

	async onModuleDestroy(): Promise<void> {
		await this.scheduleRetiredDriverDisposal(true);
	}

	onModuleInit(): void {
		const rotationConfig: { intervalMs: number; isEnabled: boolean } = this.connectorService.getRotationConfig();

		if (!rotationConfig.isEnabled) {
			return;
		}

		const dataSource: DataSource = this.getRequiredDataSource();
		this.installDataSourceTracking(dataSource);

		const interval: ReturnType<typeof setInterval> = setInterval(() => {
			void this.safeRotateDatabaseConnection();
		}, rotationConfig.intervalMs);

		this.schedulerRegistry.addInterval(this.rotationIntervalName, interval);
		this.LOGGER.log(`DB credentials rotation interval started: ${String(rotationConfig.intervalMs)} ms`);
	}

	async rotateDatabaseConnection(): Promise<void> {
		this.LOGGER.log("Launching DB credentials rotation interval...");

		const dataSource: DataSource = this.getRequiredDataSource();
		this.installDataSourceTracking(dataSource);

		if (!dataSource.isInitialized) {
			this.LOGGER.warn("Skipping DB credentials rotation because the live DataSource is not initialized yet");

			return;
		}

		// First verify the current connection is actually healthy
		await this.validateConnectionHealth(dataSource);

		// Get fresh credentials from AWS
		const freshOptions: DataSourceOptions = await this.connectorService.getTypeOrmOptions();
		const mergedOptions: DataSourceOptions = this.mergeDataSourceOptions(dataSource.options, freshOptions);
		const nextDataSource: DataSource = this.createReplacementDataSource(mergedOptions);

		try {
			await nextDataSource.initialize();
			await this.verifyNewConnection(nextDataSource);
		} catch (error) {
			await this.destroyReplacementDataSource(nextDataSource);

			throw error;
		}

		this.promoteReplacementDataSource(dataSource, nextDataSource, mergedOptions);
		void this.scheduleRetiredDriverDisposal(false);

		this.LOGGER.log("Rotation completed successfully!");
	}

	protected createReplacementDataSource(options: DataSourceOptions): DataSource {
		return new DataSource(options);
	}

	private asMutableDriver(driver: DataSource["driver"]): TMutableDriver {
		return driver as TMutableDriver;
	}

	private async attemptEmergencyRecovery(): Promise<void> {
		try {
			this.LOGGER.log("Attempting emergency database connection recovery...");
			await this.rotateDatabaseConnection();

			// Reset failure counter after successful recovery
			this.consecutiveFailures = 0;
			this.LOGGER.log("Emergency recovery successful!");
		} catch (recoveryError) {
			this.LOGGER.error(`Emergency recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
		}
	}

	private decrementActiveQueryRunnerCount(generation: number): void {
		const nextCount: number = (this.activeQueryRunnerCountsByGeneration.get(generation) ?? 0) - 1;

		if (nextCount <= 0) {
			this.activeQueryRunnerCountsByGeneration.delete(generation);

			return;
		}

		this.activeQueryRunnerCountsByGeneration.set(generation, nextCount);
	}

	private async destroyReplacementDataSource(dataSource: DataSource): Promise<void> {
		if (!dataSource.isInitialized) {
			return;
		}

		await dataSource.destroy();
	}

	private async disposeRetiredDrivers(force: boolean): Promise<void> {
		const pendingRetiredDrivers: Array<TRetiredDriver> = [];

		for (const retiredDriver of this.retiredDrivers) {
			const activeQueryRunnerCount: number = this.activeQueryRunnerCountsByGeneration.get(retiredDriver.generation) ?? 0;

			if (!force && activeQueryRunnerCount > 0) {
				pendingRetiredDrivers.push(retiredDriver);

				continue;
			}

			try {
				await retiredDriver.driver.disconnect();
				this.LOGGER.debug(`Disposed retired DB driver from generation ${String(retiredDriver.generation)}`);
			} catch (error) {
				this.LOGGER.error(`Failed to dispose retired DB driver from generation ${String(retiredDriver.generation)}: ${error instanceof Error ? error.message : String(error)}`);

				if (!force) {
					pendingRetiredDrivers.push(retiredDriver);
				}
			}
		}

		this.retiredDrivers = pendingRetiredDrivers;
	}

	private getExtraOptions(options: DataSourceOptions): Record<string, unknown> {
		const extraCandidate: unknown = (options as { extra?: unknown }).extra;

		if (typeof extraCandidate !== "object" || extraCandidate === null || Array.isArray(extraCandidate)) {
			return {};
		}

		return {
			...(extraCandidate as Record<string, unknown>),
		};
	}

	private getRequiredDataSource(): DataSource {
		if (!this.dataSource) {
			throw new Error("Database rotation is enabled but TypeORM DataSource provider is not available.");
		}

		return this.dataSource;
	}

	private incrementActiveQueryRunnerCount(generation: number): void {
		this.activeQueryRunnerCountsByGeneration.set(generation, (this.activeQueryRunnerCountsByGeneration.get(generation) ?? 0) + 1);
	}

	private installDataSourceTracking(dataSource: DataSource): void {
		if (this.isDataSourceTrackingInstalled) {
			return;
		}

		const originalCreateQueryRunner: DataSource["createQueryRunner"] = dataSource.createQueryRunner.bind(dataSource);

		dataSource.createQueryRunner = (mode?: TQueryRunnerMode): QueryRunner => {
			const generation: number = this.currentDriverGeneration;
			this.incrementActiveQueryRunnerCount(generation);

			try {
				const queryRunner: QueryRunner = originalCreateQueryRunner(mode);

				this.trackQueryRunnerRelease(generation, queryRunner);

				return queryRunner;
			} catch (error) {
				this.decrementActiveQueryRunnerCount(generation);

				throw error;
			}
		};

		this.isDataSourceTrackingInstalled = true;
	}

	private mergeDataSourceOptions(currentOptions: DataSourceOptions, freshOptions: DataSourceOptions): DataSourceOptions {
		this.validateRotationDataSourceOptions(currentOptions);
		this.validateRotationDataSourceOptions(freshOptions);

		return {
			...currentOptions,
			...freshOptions,
			extra: {
				...this.getExtraOptions(currentOptions),
				...this.getExtraOptions(freshOptions),
			},
		} as DataSourceOptions;
	}

	private promoteReplacementDataSource(dataSource: DataSource, nextDataSource: DataSource, mergedOptions: DataSourceOptions): void {
		const mutableCurrentDriver: TMutableDriver = this.asMutableDriver(dataSource.driver);
		const mutableNextDriver: TMutableDriver = this.asMutableDriver(nextDataSource.driver);
		const retiredGeneration: number = this.currentDriverGeneration;

		this.currentDriverGeneration += 1;
		mutableNextDriver.connection = dataSource;
		dataSource.driver = mutableNextDriver;
		dataSource.setOptions(mergedOptions);
		mutableNextDriver.options = dataSource.options;
		this.retiredDrivers.push({
			driver: mutableCurrentDriver,
			generation: retiredGeneration,
		});
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

	private scheduleRetiredDriverDisposal(force: boolean): Promise<void> {
		const nextDisposal: Promise<void> = this.retiredDriverDisposal
			.catch((error: unknown) => {
				this.LOGGER.error(`Retired driver disposal chain failed: ${error instanceof Error ? error.message : String(error)}`);
			})
			.then(async () => {
				await this.disposeRetiredDrivers(force);
			});

		this.retiredDriverDisposal = nextDisposal;

		return nextDisposal;
	}

	private trackQueryRunnerRelease(generation: number, queryRunner: QueryRunner): void {
		const originalRelease: QueryRunner["release"] = queryRunner.release.bind(queryRunner);
		let isTrackedReleaseHandled: boolean = false;

		queryRunner.release = async (): Promise<void> => {
			let shouldHandleTrackedRelease: boolean = false;

			try {
				await originalRelease();
			} finally {
				shouldHandleTrackedRelease = !isTrackedReleaseHandled;
				isTrackedReleaseHandled = true;
			}

			if (!shouldHandleTrackedRelease) {
				return;
			}

			this.decrementActiveQueryRunnerCount(generation);
			await this.scheduleRetiredDriverDisposal(false);
		};
	}

	private async validateConnectionHealth(dataSource: DataSource): Promise<void> {
		if (!dataSource.isInitialized) {
			this.LOGGER.warn("Current data source is not initialized, no health check needed");

			return;
		}

		try {
			// Test the current connection with a simple query
			const queryRunner: QueryRunner = dataSource.createQueryRunner();

			try {
				await queryRunner.query("SELECT 1");
			} finally {
				await queryRunner.release();
			}

			this.LOGGER.debug("Current connection is healthy");
		} catch (error) {
			this.LOGGER.warn(`Current connection health check failed: ${error instanceof Error ? error.message : String(error)}`);
			// We don't throw here, we'll continue with rotation to fix the issue
		}
	}

	private validateRotationDataSourceOptions(options: DataSourceOptions): void {
		if (options.type === "mysql" || options.type === "postgres") {
			return;
		}

		throw new Error(`Database rotation is supported only for "mysql" and "postgres" data sources. Received: "${options.type}".`);
	}

	private async verifyNewConnection(dataSource: DataSource): Promise<void> {
		try {
			const queryRunner: QueryRunner = dataSource.createQueryRunner();

			try {
				await queryRunner.query("SELECT 1");
			} finally {
				await queryRunner.release();
			}

			this.LOGGER.debug("New connection verified successfully");
		} catch (error) {
			this.LOGGER.error(`New connection verification failed: ${error instanceof Error ? error.message : String(error)}`);

			throw new Error(`Failed to verify new database connection: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
