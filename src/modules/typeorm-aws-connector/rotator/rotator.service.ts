import type { TTypeOrmAwsConnectorRotationEvent, TTypeOrmAwsConnectorRotationEventListener } from "@shared/type/typeorm-aws-connector";
import type { DataSourceOptions, QueryRunner } from "typeorm";

import type { TMutableDriver, TQueryRunnerMode, TRetiringDriver } from "./type";

import { BeforeApplicationShutdown, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ETypeOrmAwsConnectorDrainTimeoutPhase, ETypeOrmAwsConnectorRotationDeferredReason, ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";
import { DataSource } from "typeorm";

import { TypeOrmAwsConnectorService } from "../typeorm-aws-connector.service";

@Injectable()
export class RotatorService implements BeforeApplicationShutdown, OnModuleInit {
	private readonly activeQueryRunnerCountsByGeneration: Map<number, number> = new Map<number, number>();

	private readonly activeQueryRunnersByGeneration: Map<number, Set<QueryRunner>> = new Map<number, Set<QueryRunner>>();

	private consecutiveFailures: number = 0;

	private currentDriverGeneration: number = 0;

	private readonly drainStateWaiters: Set<() => void> = new Set<() => void>();

	private isDataSourceTrackingInstalled: boolean = false;

	private isRotationIntervalRegistered: boolean = false;

	private isShutdownInProgress: boolean = false;

	private readonly LOGGER: Logger;

	private readonly MAX_CONSECUTIVE_FAILURES: number = 3;

	private pendingReplacementDataSource: DataSource | undefined;

	private retiringDriver: TRetiringDriver | undefined;

	private retiringDriverDisposal: Promise<void> = Promise.resolve();

	private rotationEventListener: TTypeOrmAwsConnectorRotationEventListener | undefined;

	private rotationPromise: Promise<boolean> | undefined;

	private shutdownDrainTimeoutMs: number | undefined;

	private shutdownPromise: Promise<void> | undefined;

	constructor(
		private readonly dataSource: DataSource | undefined,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly connectorService: TypeOrmAwsConnectorService,
		private readonly rotationIntervalName: string,
	) {
		this.LOGGER = new Logger(`${RotatorService.name}:${this.rotationIntervalName}`);
	}

	beforeApplicationShutdown(): Promise<void> {
		this.shutdownPromise ??= this.shutdown();

		return this.shutdownPromise;
	}

	onModuleInit(): void {
		const rotationConfig: ReturnType<TypeOrmAwsConnectorService["getRotationConfig"]> = this.connectorService.getRotationConfig();

		this.rotationEventListener = rotationConfig.onEvent;

		if (!rotationConfig.isEnabled) {
			return;
		}

		this.shutdownDrainTimeoutMs = rotationConfig.shutdownDrainTimeoutMs;

		const dataSource: DataSource = this.getRequiredDataSource();

		this.installDataSourceTracking(dataSource);

		const interval: ReturnType<typeof setInterval> = setInterval(() => {
			void this.safeRotateDatabaseConnection();
		}, rotationConfig.intervalMs);

		try {
			this.schedulerRegistry.addInterval(this.rotationIntervalName, interval);
			this.isRotationIntervalRegistered = true;
		} catch (error) {
			clearInterval(interval);

			throw error;
		}

		this.LOGGER.log(`DB credentials rotation interval started: ${String(rotationConfig.intervalMs)} ms`);
	}

	async rotateDatabaseConnection(): Promise<void> {
		await this.requestDatabaseRotation();
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

			const didRotate: boolean = await this.requestDatabaseRotation();

			if (!didRotate) {
				this.LOGGER.warn("Emergency database connection recovery was deferred");

				return;
			}

			this.consecutiveFailures = 0;
			this.LOGGER.log("Emergency recovery successful!");
		} catch (recoveryError) {
			this.LOGGER.error(`Emergency recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
		}
	}

	private async closeCurrentDataSource(isForced: boolean): Promise<Error | undefined> {
		const dataSource: DataSource = this.getRequiredDataSource();

		if (!dataSource.isInitialized) {
			return undefined;
		}

		const closeErrors: Array<Error> = isForced ? await this.releaseActiveQueryRunners(this.currentDriverGeneration) : [];

		try {
			await dataSource.destroy();
			this.emitRotationEvent({
				currentGeneration: this.currentDriverGeneration,
				generation: this.currentDriverGeneration,
				isForced,
				type: ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED,
			});
		} catch (error) {
			closeErrors.push(new Error(`Failed to close current DB generation ${String(this.currentDriverGeneration)} during shutdown: ${error instanceof Error ? error.message : String(error)}`, { cause: error }));
		}

		if (closeErrors.length === 0) {
			return undefined;
		}

		return closeErrors.length === 1 ? closeErrors[0] : new AggregateError(closeErrors, `Current DB generation ${String(this.currentDriverGeneration)} could not be closed cleanly.`, { cause: closeErrors.at(-1) });
	}

	private async closeGenerationsWithinTimeout(isForced: boolean, timeoutMs: number): Promise<{ errors: Array<Error>; isTimedOut: boolean }> {
		const closePromise: Promise<Array<Error>> = this.performBestEffortGenerationClose(isForced);
		let timeout: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise: Promise<null> = new Promise<null>((resolve) => {
			timeout = setTimeout(() => {
				resolve(null);
			}, timeoutMs);
		});
		const result: Array<Error> | null = await Promise.race([closePromise, timeoutPromise]);

		if (timeout !== undefined) {
			clearTimeout(timeout);
		}

		if (result === null) {
			void closePromise.then((lateErrors: Array<Error>) => {
				for (const lateError of lateErrors) {
					this.LOGGER.error(`Database generation close failed after the shutdown timeout: ${lateError.message}`);
				}
			});

			return {
				errors: [],
				isTimedOut: true,
			};
		}

		return {
			errors: result,
			isTimedOut: false,
		};
	}

	private decrementActiveQueryRunnerCount(generation: number): void {
		const nextCount: number = (this.activeQueryRunnerCountsByGeneration.get(generation) ?? 0) - 1;

		if (nextCount <= 0) {
			this.activeQueryRunnerCountsByGeneration.delete(generation);
		} else {
			this.activeQueryRunnerCountsByGeneration.set(generation, nextCount);
		}

		this.notifyDrainStateChanged();
	}

	private async destroyPendingReplacementDataSource(): Promise<Error | undefined> {
		const pendingReplacementDataSource: DataSource | undefined = this.pendingReplacementDataSource;

		if (pendingReplacementDataSource === undefined) {
			return undefined;
		}

		try {
			await this.destroyReplacementDataSource(pendingReplacementDataSource);

			return undefined;
		} catch (error) {
			return new Error(`Failed to close pending replacement DataSource during shutdown: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
	}

	private async destroyReplacementDataSource(dataSource: DataSource): Promise<void> {
		if (dataSource.isInitialized) {
			try {
				await dataSource.destroy();
			} catch (error) {
				try {
					await this.disconnectReplacementQueryResultCache(dataSource);
				} catch (cacheError) {
					throw new AggregateError([error, cacheError], "Replacement DataSource and its query-result cache could not be closed.", { cause: cacheError });
				}

				throw error;
			}

			return;
		}

		const cleanupErrors: Array<unknown> = [];

		try {
			await this.disconnectReplacementQueryResultCache(dataSource);
		} catch (error) {
			cleanupErrors.push(error);
		}

		try {
			await dataSource.driver.disconnect();
		} catch (error) {
			if (!(error instanceof Error && error.name === "ConnectionIsNotSetError")) {
				cleanupErrors.push(error);
			}
		}

		if (cleanupErrors.length === 1) {
			throw cleanupErrors[0];
		}

		if (cleanupErrors.length > 1) {
			throw new AggregateError(cleanupErrors, "Replacement DataSource resources could not be closed.", { cause: cleanupErrors.at(-1) });
		}
	}

	private async disconnectReplacementQueryResultCache(dataSource: DataSource): Promise<void> {
		if (dataSource.queryResultCache === undefined) {
			return;
		}

		await dataSource.queryResultCache.disconnect();
		Reflect.deleteProperty(dataSource, "queryResultCache");
	}

	private async disposeRetiringDriver(isForced: boolean): Promise<Error | undefined> {
		const retiringDriver: TRetiringDriver | undefined = this.retiringDriver;

		if (retiringDriver === undefined) {
			return undefined;
		}

		const activeQueryRunnerCount: number = this.getActiveQueryRunnerCount(retiringDriver.generation);

		if (!isForced && activeQueryRunnerCount > 0) {
			return undefined;
		}

		const disposalErrors: Array<Error> = isForced ? await this.releaseActiveQueryRunners(retiringDriver.generation) : [];
		let isDisconnected: boolean = false;

		try {
			await retiringDriver.driver.disconnect();
			isDisconnected = true;
		} catch (error) {
			const disposalError: Error = new Error(`Failed to close retiring DB generation ${String(retiringDriver.generation)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });

			this.LOGGER.error(disposalError.message);
			disposalErrors.push(disposalError);
		}

		if (isDisconnected && this.retiringDriver === retiringDriver) {
			this.retiringDriver = undefined;
		}

		if (isDisconnected) {
			this.emitRotationEvent({
				currentGeneration: this.currentDriverGeneration,
				generation: retiringDriver.generation,
				isForced,
				type: ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED,
			});
			this.LOGGER.debug(`Disposed retiring DB driver from generation ${String(retiringDriver.generation)}`);
		}

		if (disposalErrors.length === 0) {
			return undefined;
		}

		return disposalErrors.length === 1 ? disposalErrors[0] : new AggregateError(disposalErrors, `Retiring DB generation ${String(retiringDriver.generation)} could not be closed cleanly.`, { cause: disposalErrors.at(-1) });
	}

	private emitDrainTimeoutEvent(phase: ETypeOrmAwsConnectorDrainTimeoutPhase, shutdownDrainTimeoutMs: number): void {
		this.emitRotationEvent({
			activeQueryRunnerCount: this.getActiveQueryRunnerCount(),
			currentGeneration: this.currentDriverGeneration,
			phase,
			retiringGeneration: this.retiringDriver?.generation ?? null,
			shutdownDrainTimeoutMs,
			type: ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT,
		});
	}

	private emitRotationDeferredEvent(reason: ETypeOrmAwsConnectorRotationDeferredReason): void {
		const retiringGeneration: number | undefined = this.retiringDriver?.generation;

		this.emitRotationEvent({
			currentGeneration: this.currentDriverGeneration,
			reason,
			retiringGeneration: retiringGeneration ?? null,
			retiringGenerationActiveQueryRunnerCount: retiringGeneration === undefined ? 0 : this.getActiveQueryRunnerCount(retiringGeneration),
			type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED,
		});
	}

	private emitRotationEvent(event: TTypeOrmAwsConnectorRotationEvent): void {
		if (this.rotationEventListener === undefined) {
			return;
		}

		try {
			void Promise.resolve(this.rotationEventListener(Object.freeze(event))).catch((error: unknown) => {
				this.LOGGER.error(`DB rotation event listener failed for "${event.type}": ${error instanceof Error ? error.message : String(error)}`);
			});
		} catch (error) {
			this.LOGGER.error(`DB rotation event listener failed for "${event.type}": ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private ensureRotationLifecycleConfig(): void {
		if (this.shutdownDrainTimeoutMs !== undefined) {
			return;
		}

		const rotationConfig: ReturnType<TypeOrmAwsConnectorService["getRotationConfig"]> = this.connectorService.getRotationConfig();

		this.rotationEventListener = rotationConfig.onEvent;

		if (rotationConfig.shutdownDrainTimeoutMs === undefined) {
			throw new Error('Database rotation requires a positive "rotation.shutdownDrainTimeoutMs" value.');
		}

		this.shutdownDrainTimeoutMs = rotationConfig.shutdownDrainTimeoutMs;
	}

	private getActiveQueryRunnerCount(generation?: number): number {
		if (generation !== undefined) {
			return this.activeQueryRunnerCountsByGeneration.get(generation) ?? 0;
		}

		let activeQueryRunnerCount: number = 0;

		for (const generationActiveQueryRunnerCount of this.activeQueryRunnerCountsByGeneration.values()) {
			activeQueryRunnerCount += generationActiveQueryRunnerCount;
		}

		return activeQueryRunnerCount;
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

	private getPromotionDataSourceOptions(options: DataSourceOptions): DataSourceOptions {
		const promotionOptions: DataSourceOptions = {
			...options,
		};

		Reflect.deleteProperty(promotionOptions, "cache");

		return promotionOptions;
	}

	private getReplacementDataSourceOptions(options: DataSourceOptions): DataSourceOptions {
		return {
			...options,
			dropSchema: false,
			installExtensions: false,
			migrationsRun: false,
			synchronize: false,
		} as DataSourceOptions;
	}

	private getRequiredDataSource(): DataSource {
		if (!this.dataSource) {
			throw new Error("Database rotation is enabled but TypeORM DataSource provider is not available.");
		}

		return this.dataSource;
	}

	private getRequiredShutdownDrainTimeoutMs(): number {
		if (this.shutdownDrainTimeoutMs === undefined) {
			throw new Error('Database rotation requires a positive "rotation.shutdownDrainTimeoutMs" value.');
		}

		return this.shutdownDrainTimeoutMs;
	}

	private incrementActiveQueryRunnerCount(generation: number): void {
		this.activeQueryRunnerCountsByGeneration.set(generation, (this.activeQueryRunnerCountsByGeneration.get(generation) ?? 0) + 1);
		this.notifyDrainStateChanged();
	}

	private installDataSourceTracking(dataSource: DataSource): void {
		if (this.isDataSourceTrackingInstalled) {
			return;
		}

		const originalCreateQueryRunner: DataSource["createQueryRunner"] = dataSource.createQueryRunner.bind(dataSource);

		dataSource.createQueryRunner = (mode?: TQueryRunnerMode): QueryRunner => {
			if (this.isShutdownInProgress) {
				throw new Error("Cannot create a TypeORM query runner while database rotation shutdown is in progress.");
			}

			const generation: number = this.currentDriverGeneration;
			const queryRunner: QueryRunner = originalCreateQueryRunner(mode);
			const generationQueryRunners: Set<QueryRunner> = this.activeQueryRunnersByGeneration.get(generation) ?? new Set<QueryRunner>();

			generationQueryRunners.add(queryRunner);
			this.activeQueryRunnersByGeneration.set(generation, generationQueryRunners);
			this.incrementActiveQueryRunnerCount(generation);

			try {
				this.trackQueryRunnerRelease(generation, queryRunner);

				return queryRunner;
			} catch (error) {
				generationQueryRunners.delete(queryRunner);

				if (generationQueryRunners.size === 0) {
					this.activeQueryRunnersByGeneration.delete(generation);
				}

				this.decrementActiveQueryRunnerCount(generation);

				throw error;
			}
		};

		this.isDataSourceTrackingInstalled = true;
	}

	private mergeDataSourceOptions(currentOptions: DataSourceOptions, freshOptions: DataSourceOptions): DataSourceOptions {
		this.validateRotationDataSourceOptions(currentOptions);
		this.validateRotationDataSourceOptions(freshOptions);

		if (currentOptions.type !== freshOptions.type) {
			throw new Error(`Database rotation cannot change the TypeORM data source type from "${currentOptions.type}" to "${freshOptions.type}".`);
		}

		return {
			...currentOptions,
			...freshOptions,
			extra: {
				...this.getExtraOptions(currentOptions),
				...this.getExtraOptions(freshOptions),
			},
		} as DataSourceOptions;
	}

	private notifyDrainStateChanged(): void {
		for (const waiter of this.drainStateWaiters) {
			waiter();
		}

		this.drainStateWaiters.clear();
	}

	private async performBestEffortGenerationClose(isForced: boolean): Promise<Array<Error>> {
		const [currentDataSourceError, pendingReplacementDataSourceError, retiringDriverError]: [Error | undefined, Error | undefined, Error | undefined] = await Promise.all([this.closeCurrentDataSource(isForced), this.destroyPendingReplacementDataSource(), this.scheduleRetiringDriverDisposal(isForced)]);

		return [currentDataSourceError, pendingReplacementDataSourceError, retiringDriverError].filter((error): error is Error => error !== undefined);
	}

	private async performDatabaseRotation(): Promise<boolean> {
		this.LOGGER.log("Launching DB credentials rotation...");
		this.ensureRotationLifecycleConfig();

		const dataSource: DataSource = this.getRequiredDataSource();

		this.installDataSourceTracking(dataSource);

		if (!dataSource.isInitialized) {
			this.LOGGER.warn("Skipping DB credentials rotation because the live DataSource is not initialized yet");
			this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.DATA_SOURCE_NOT_INITIALIZED);

			return false;
		}

		if (!(await this.prepareRetiringGenerationForRotation())) {
			return false;
		}

		await this.validateConnectionHealth(dataSource);

		if (this.isShutdownInProgress) {
			this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);

			return false;
		}

		const freshOptions: DataSourceOptions = await this.connectorService.getTypeOrmOptions();

		if (this.isShutdownInProgress) {
			this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);

			return false;
		}

		const mergedOptions: DataSourceOptions = this.mergeDataSourceOptions(dataSource.options, freshOptions);
		const replacementOptions: DataSourceOptions = this.getReplacementDataSourceOptions(mergedOptions);
		const nextDataSource: DataSource = this.createReplacementDataSource(replacementOptions);
		let isPromoted: boolean = false;

		this.pendingReplacementDataSource = nextDataSource;

		try {
			await nextDataSource.initialize();

			if (this.isShutdownInProgress) {
				this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);
				await this.destroyReplacementDataSource(nextDataSource);

				return false;
			}

			await this.verifyNewConnection(nextDataSource);

			if (this.isShutdownInProgress) {
				this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);
				await this.destroyReplacementDataSource(nextDataSource);

				return false;
			}

			await this.disconnectReplacementQueryResultCache(nextDataSource);

			if (this.isShutdownInProgress) {
				this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);
				await this.destroyReplacementDataSource(nextDataSource);

				return false;
			}

			this.promoteReplacementDataSource(dataSource, nextDataSource, mergedOptions);
			isPromoted = true;
			this.pendingReplacementDataSource = undefined;

			const disposalError: Error | undefined = await this.scheduleRetiringDriverDisposal(false);

			if (disposalError !== undefined) {
				this.LOGGER.warn(`Rotation promoted generation ${String(this.currentDriverGeneration)}, but generation ${String(this.retiringDriver?.generation ?? this.currentDriverGeneration - 1)} could not be closed yet`);
			}

			this.LOGGER.log("Rotation completed successfully!");

			return true;
		} catch (error) {
			if (isPromoted) {
				throw error;
			}

			try {
				await this.destroyReplacementDataSource(nextDataSource);
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], "Database rotation failed and the replacement DataSource could not be closed.", { cause: cleanupError });
			}

			throw error;
		} finally {
			if (this.pendingReplacementDataSource === nextDataSource) {
				this.pendingReplacementDataSource = undefined;
			}
		}
	}

	private async prepareRetiringGenerationForRotation(): Promise<boolean> {
		const disposalError: Error | undefined = await this.scheduleRetiringDriverDisposal(false);

		if (this.retiringDriver === undefined) {
			return true;
		}

		const reason: ETypeOrmAwsConnectorRotationDeferredReason = disposalError === undefined ? ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_ACTIVE : ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_CLOSE_FAILED;

		this.emitRotationDeferredEvent(reason);
		this.LOGGER.warn(`Database rotation deferred because generation ${String(this.retiringDriver.generation)} has ${String(this.getActiveQueryRunnerCount(this.retiringDriver.generation))} active query runners or could not be closed`);

		return false;
	}

	private promoteReplacementDataSource(dataSource: DataSource, nextDataSource: DataSource, mergedOptions: DataSourceOptions): void {
		if (this.retiringDriver !== undefined) {
			throw new Error(`Database rotation invariant violated: generation ${String(this.retiringDriver.generation)} is still retiring.`);
		}

		const mutableCurrentDriver: TMutableDriver = this.asMutableDriver(dataSource.driver);
		const mutableNextDriver: TMutableDriver = this.asMutableDriver(nextDataSource.driver);
		const retiringGeneration: number = this.currentDriverGeneration;

		const retiringOptions: DataSourceOptions = {
			...dataSource.options,
			extra: this.getExtraOptions(dataSource.options),
		};

		this.currentDriverGeneration += 1;
		mutableNextDriver.connection = dataSource;
		dataSource.driver = mutableNextDriver;
		dataSource.setOptions(this.getPromotionDataSourceOptions(mergedOptions));
		mutableCurrentDriver.options = retiringOptions;
		mutableNextDriver.options = dataSource.options;
		this.retiringDriver = {
			driver: mutableCurrentDriver,
			generation: retiringGeneration,
		};
	}

	private async releaseActiveQueryRunners(generation: number): Promise<Array<Error>> {
		const queryRunners: Array<QueryRunner> = [...(this.activeQueryRunnersByGeneration.get(generation) ?? [])];
		const releaseResults: Array<PromiseSettledResult<void>> = await Promise.allSettled(queryRunners.map(async (queryRunner: QueryRunner) => queryRunner.release()));

		return releaseResults.flatMap((releaseResult: PromiseSettledResult<void>) => {
			if (releaseResult.status === "fulfilled") {
				return [];
			}

			return [new Error(`Failed to release an active query runner from DB generation ${String(generation)} during forced shutdown: ${releaseResult.reason instanceof Error ? releaseResult.reason.message : String(releaseResult.reason)}`, { cause: releaseResult.reason })];
		});
	}

	private async requestDatabaseRotation(): Promise<boolean> {
		if (this.isShutdownInProgress) {
			this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS);

			return false;
		}

		if (this.rotationPromise !== undefined) {
			this.emitRotationDeferredEvent(ETypeOrmAwsConnectorRotationDeferredReason.ROTATION_IN_PROGRESS);

			return false;
		}

		const rotationPromise: Promise<boolean> = this.performDatabaseRotation();

		this.rotationPromise = rotationPromise;

		try {
			return await rotationPromise;
		} finally {
			if (this.rotationPromise === rotationPromise) {
				this.rotationPromise = undefined;
			}

			this.notifyDrainStateChanged();
		}
	}

	private async safeRotateDatabaseConnection(): Promise<void> {
		try {
			const didRotate: boolean = await this.requestDatabaseRotation();

			if (didRotate) {
				this.consecutiveFailures = 0;
			}
		} catch (error) {
			this.consecutiveFailures++;
			this.LOGGER.error(`Database rotation failed: ${error instanceof Error ? error.message : String(error)}`);

			if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
				this.LOGGER.warn(`${String(this.consecutiveFailures)} consecutive rotation failures. Attempting emergency recovery...`);
				await this.attemptEmergencyRecovery();
			}
		}
	}

	private scheduleRetiringDriverDisposal(isForced: boolean): Promise<Error | undefined> {
		const disposalPromise: Promise<Error | undefined> = this.retiringDriverDisposal.then(async () => this.disposeRetiringDriver(isForced));

		this.retiringDriverDisposal = disposalPromise.then(() => {
			// Keep the serialization chain result-free; the requesting caller receives the disposal error.
		});

		return disposalPromise;
	}

	private async shutdown(): Promise<void> {
		this.isShutdownInProgress = true;

		const errors: Array<Error> = [];
		const intervalStopError: Error | undefined = this.stopRotationInterval();

		if (intervalStopError !== undefined) {
			errors.push(intervalStopError);
		}

		if (!this.isDataSourceTrackingInstalled) {
			if (errors.length > 0) {
				throw new AggregateError(errors, "Database rotation shutdown failed.");
			}

			return;
		}

		const shutdownDrainTimeoutMs: number = this.getRequiredShutdownDrainTimeoutMs();
		const didDrain: boolean = await this.waitForDrain(shutdownDrainTimeoutMs);

		if (!didDrain) {
			this.emitDrainTimeoutEvent(ETypeOrmAwsConnectorDrainTimeoutPhase.DRAIN, shutdownDrainTimeoutMs);
			errors.push(new Error(`Database generations did not drain within ${String(shutdownDrainTimeoutMs)} ms; ${String(this.getActiveQueryRunnerCount())} query runners remain active.`));
		}

		const closeResult: { errors: Array<Error>; isTimedOut: boolean } = await this.closeGenerationsWithinTimeout(!didDrain, shutdownDrainTimeoutMs);

		errors.push(...closeResult.errors);

		if (closeResult.isTimedOut) {
			this.emitDrainTimeoutEvent(ETypeOrmAwsConnectorDrainTimeoutPhase.GENERATION_CLOSE, shutdownDrainTimeoutMs);
			errors.push(new Error(`Database generation close did not settle within ${String(shutdownDrainTimeoutMs)} ms.`));
		}

		if (errors.length > 0) {
			throw new AggregateError(errors, "Database rotation shutdown failed.");
		}
	}

	private stopRotationInterval(): Error | undefined {
		if (!this.isRotationIntervalRegistered) {
			return undefined;
		}

		try {
			if (!this.schedulerRegistry.doesExist("interval", this.rotationIntervalName)) {
				this.isRotationIntervalRegistered = false;

				return undefined;
			}

			this.schedulerRegistry.deleteInterval(this.rotationIntervalName);
			this.isRotationIntervalRegistered = false;

			return undefined;
		} catch (error) {
			return new Error(`Failed to stop DB rotation interval "${this.rotationIntervalName}": ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
	}

	private trackQueryRunnerRelease(generation: number, queryRunner: QueryRunner): void {
		const originalRelease: QueryRunner["release"] = queryRunner.release.bind(queryRunner);
		let isTrackedReleaseHandled: boolean = false;

		queryRunner.release = async (): Promise<void> => {
			await originalRelease();

			if (isTrackedReleaseHandled) {
				return;
			}

			isTrackedReleaseHandled = true;
			const generationQueryRunners: Set<QueryRunner> | undefined = this.activeQueryRunnersByGeneration.get(generation);

			generationQueryRunners?.delete(queryRunner);

			if (generationQueryRunners?.size === 0) {
				this.activeQueryRunnersByGeneration.delete(generation);
			}

			this.decrementActiveQueryRunnerCount(generation);

			void this.scheduleRetiringDriverDisposal(false)
				.then((disposalError: Error | undefined) => {
					if (disposalError !== undefined) {
						this.LOGGER.warn(disposalError.message);
					}
				})
				.catch((error: unknown) => {
					this.LOGGER.error(`Retiring DB generation disposal failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`);
				});
		};
	}

	private async validateConnectionHealth(dataSource: DataSource): Promise<void> {
		if (!dataSource.isInitialized) {
			this.LOGGER.warn("Current data source is not initialized, no health check needed");

			return;
		}

		try {
			const queryRunner: QueryRunner = dataSource.createQueryRunner();

			try {
				await queryRunner.query("SELECT 1");
			} finally {
				await queryRunner.release();
			}

			this.LOGGER.debug("Current connection is healthy");
		} catch (error) {
			this.LOGGER.warn(`Current connection health check failed: ${error instanceof Error ? error.message : String(error)}`);
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

			throw new Error(`Failed to verify new database connection: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		}
	}

	private async waitForDrain(timeoutMs: number): Promise<boolean> {
		const deadline: number = Date.now() + timeoutMs;

		while (this.rotationPromise !== undefined || this.getActiveQueryRunnerCount() > 0) {
			const remainingTimeoutMs: number = deadline - Date.now();

			if (remainingTimeoutMs <= 0) {
				return false;
			}

			await this.waitForDrainStateChange(remainingTimeoutMs);
		}

		return true;
	}

	private waitForDrainStateChange(timeoutMs: number): Promise<void> {
		return new Promise<void>((resolve) => {
			const waiter = (): void => {
				clearTimeout(timeout);
				this.drainStateWaiters.delete(waiter);
				resolve();
			};

			this.drainStateWaiters.add(waiter);
			const timeout: ReturnType<typeof setTimeout> = setTimeout(waiter, timeoutMs);
		});
	}
}
