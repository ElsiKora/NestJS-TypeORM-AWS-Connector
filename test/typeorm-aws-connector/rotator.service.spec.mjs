import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ETypeOrmAwsConnectorDrainTimeoutPhase, ETypeOrmAwsConnectorRotationDeferredReason, ETypeOrmAwsConnectorRotationEvent, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";
import { Logger } from "@nestjs/common";

import { createDeferred, createFakeDataSource, createFakeSchedulerRegistry, TestRotatorService } from "./rotator-test.utility.mjs";

const RAW_FAILURE_CANARY = "SELECT secret FROM ledger WHERE profile='prod' host=10.0.0.7 url=https://private.invalid password=exposed";

const createLogCanaryFailure = () =>
	Object.assign(new Error(RAW_FAILURE_CANARY), {
		code: "23505",
		name: "QueryFailedError",
		parameters: [RAW_FAILURE_CANARY],
		query: RAW_FAILURE_CANARY,
		stack: RAW_FAILURE_CANARY,
	});

const readLoggedErrors = (errorLogger) => errorLogger.mock.calls.flatMap((call) => call.arguments).join("\n");

const flushAsyncWork = async () => {
	await new Promise((resolve) => {
		setImmediate(resolve);
	});
};

const waitFor = async (predicate, message) => {
	for (let index = 0; index < 100; index += 1) {
		if (predicate()) {
			return;
		}

		await flushAsyncWork();
	}

	throw new Error(message);
};

const createConnectorService = ({ events, getTypeOrmOptions, intervalMs = 1_000, shutdownDrainTimeoutMs = 100 }) => ({
	getRotationConfig: () => ({
		intervalMs,
		isEnabled: true,
		onEvent: (event) => {
			events.push(event);
		},
		shutdownDrainTimeoutMs,
	}),
	getTypeOrmOptions,
});

describe("RotatorService bounded lifecycle", () => {
	it("requires a positive shutdown drain timeout whenever rotation is enabled", () => {
		const createService = (shutdownDrainTimeoutMs) =>
			new TypeOrmAwsConnectorService(
				{
					get: () => undefined,
				},
				{
					get: () => null,
				},
				{
					entities: [],
					rotation: {
						isEnabled: true,
						shutdownDrainTimeoutMs,
					},
				},
			);

		assert.throws(() => createService(undefined).getRotationConfig(), /error.*rotation\.shutdownDrainTimeoutMs|Value for "rotation\.shutdownDrainTimeoutMs"/i);
		assert.throws(
			() => createService(0).getRotationConfig(),
			(error) => error instanceof RangeError && error.message.includes("rotation.shutdownDrainTimeoutMs") && error.message.includes("positive integer"),
		);

		const disabledService = new TypeOrmAwsConnectorService(
			{
				get: () => undefined,
			},
			{
				get: () => null,
			},
			{
				entities: [],
				rotation: {
					isEnabled: false,
					shutdownDrainTimeoutMs: 25,
				},
			},
		);

		assert.deepEqual(disabledService.getRotationConfig(), {
			intervalMs: 3_600_000,
			isEnabled: false,
			onEvent: undefined,
			shutdownDrainTimeoutMs: 25,
		});
	});

	it("coalesces intervals and keeps a long transaction on its original generation", async () => {
		const originalSetInterval = globalThis.setInterval;
		const events = [];
		const optionsDeferred = createDeferred();
		const schedulerRegistry = createFakeSchedulerRegistry();

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});
		const generationZeroDriver = liveDataSource.driver;

		const firstReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
			options: {
				password: "password-1",
				username: "user-1",
			},
		});

		const secondReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-2",
			options: {
				password: "password-2",
				username: "user-2",
			},
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				if (optionsCalls === 1) {
					return optionsDeferred.promise;
				}

				return secondReplacement.options;
			},
		});

		globalThis.setInterval = (callback, timeout) => ({
			callback,
			timeout,
		});

		try {
			const rotatorService = new TestRotatorService(liveDataSource, schedulerRegistry, connectorService, "db-rotation:bounded", [firstReplacement, secondReplacement]);

			rotatorService.onModuleInit();

			const interval = schedulerRegistry.intervals.get("db-rotation:bounded");
			const transactionQueryRunner = liveDataSource.createQueryRunner();
			const transactionManager = transactionQueryRunner.manager;

			await transactionManager.queryRunner.query("BEGIN");
			interval.callback();
			await waitFor(() => optionsCalls === 1, "The first interval did not request fresh options.");
			interval.callback();
			await waitFor(() => events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.ROTATION_IN_PROGRESS), "The overlapping interval was not coalesced.");

			assert.deepEqual(
				events.find((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.ROTATION_IN_PROGRESS),
				{
					currentGeneration: 0,
					reason: ETypeOrmAwsConnectorRotationDeferredReason.ROTATION_IN_PROGRESS,
					retiringGeneration: null,
					retiringGenerationActiveQueryRunnerCount: 0,
					type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED,
				},
			);

			optionsDeferred.resolve(firstReplacement.options);
			await waitFor(() => liveDataSource.driver.label === "generation-1", "The verified first replacement was not promoted.");

			assert.equal(transactionManager.queryRunner.driver, generationZeroDriver);
			assert.equal(transactionManager.queryRunner.driver.label, "generation-0");
			assert.equal(generationZeroDriver.state.disconnectCalls, 0);
			assert.equal(generationZeroDriver.options.password, "old-password");

			for (let index = 0; index < 3; index += 1) {
				interval.callback();
				await waitFor(() => events.filter((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_ACTIVE).length === index + 1, `Interval ${String(index + 1)} was not deferred behind the retiring generation.`);
			}

			assert.equal(optionsCalls, 1);
			assert.equal(secondReplacement.initializeCalls, 0);
			assert.equal(liveDataSource.driver.label, "generation-1");
			assert.equal(transactionManager.queryRunner.driver, generationZeroDriver);
			assert.deepEqual(
				events.filter((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_ACTIVE),
				Array.from({ length: 3 }, () => ({
					currentGeneration: 1,
					reason: ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_ACTIVE,
					retiringGeneration: 0,
					retiringGenerationActiveQueryRunnerCount: 1,
					type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED,
				})),
			);

			await transactionQueryRunner.query("SELECT transaction_generation");
			assert.equal(transactionManager.queryRunner.driver, generationZeroDriver);
			await transactionQueryRunner.release();
			await waitFor(() => generationZeroDriver.state.disconnectCalls === 1, "The drained retiring generation was not disposed.");

			assert.equal(generationZeroDriver.state.disconnectCalls, 1);
			assert.ok(events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED && event.generation === 0 && event.isForced === false));

			interval.callback();
			await waitFor(() => liveDataSource.driver.label === "generation-2", "Rotation did not resume after the retiring generation drained.");

			assert.equal(optionsCalls, 2);
			assert.equal(firstReplacement.driver.state.disconnectCalls, 1);
			assert.ok(events.every((event) => Object.isFrozen(event)));

			await rotatorService.beforeApplicationShutdown();
			assert.equal(secondReplacement.driver.state.disconnectCalls, 1);
		} finally {
			globalThis.setInterval = originalSetInterval;
		}
	});

	it("keeps the live generation after credential and replacement verification failures, then rotates later", async (testContext) => {
		const events = [];
		const credentialFailure = new Error("Secrets Manager unavailable");
		const initializationFailure = new Error("replacement initialization failed");
		const verificationFailure = createLogCanaryFailure();
		const errorLogger = testContext.mock.method(Logger.prototype, "error", () => undefined);

		const liveDataSource = createFakeDataSource({
			label: "live",
		});

		const failedReplacement = createFakeDataSource({
			isInitialized: false,
			label: "failed-replacement",
			queryImplementation: async () => {
				throw verificationFailure;
			},
		});

		const initializationFailedReplacement = createFakeDataSource({
			initializeImplementation: async () => {
				throw initializationFailure;
			},
			isInitialized: false,
			label: "initialization-failed-replacement",
		});

		const successfulReplacement = createFakeDataSource({
			isInitialized: false,
			label: "successful-replacement",
			options: {
				password: "new-password",
				username: "new-user",
			},
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				if (optionsCalls === 1) {
					throw credentialFailure;
				}

				if (optionsCalls === 2) {
					return failedReplacement.options;
				}

				return optionsCalls === 3 ? initializationFailedReplacement.options : successfulReplacement.options;
			},
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:failure-recovery", [failedReplacement, initializationFailedReplacement, successfulReplacement]);

		await assert.rejects(rotatorService.rotateDatabaseConnection(), (error) => error instanceof Error && error.message === "Failed to resolve fresh TypeORM options for database rotation. errorType=Error" && error.cause === credentialFailure);
		assert.equal(liveDataSource.driver.label, "live");
		assert.equal(failedReplacement.initializeCalls, 0);

		await assert.rejects(rotatorService.rotateDatabaseConnection(), (error) => error instanceof Error && error.message === "Database rotation failed. errorType=Error sqlState=23505" && error.cause instanceof Error && error.cause.message === "Failed to verify the new database connection. errorType=QueryFailedError sqlState=23505" && error.cause.cause === verificationFailure);
		assert.equal(liveDataSource.driver.label, "live");
		assert.equal(failedReplacement.destroyCalls, 1);
		assert.equal(failedReplacement.driver.state.disconnectCalls, 1);

		await assert.rejects(rotatorService.rotateDatabaseConnection(), (error) => error instanceof Error && error.message === "Database rotation failed. errorType=Error" && error.cause === initializationFailure);
		assert.equal(liveDataSource.driver.label, "live");
		assert.equal(initializationFailedReplacement.destroyCalls, 0);
		assert.equal(initializationFailedReplacement.driver.state.disconnectCalls, 1);

		await rotatorService.rotateDatabaseConnection();
		assert.equal(liveDataSource.driver.label, "successful-replacement");

		const loggedErrors = readLoggedErrors(errorLogger);

		assert.match(loggedErrors, /New connection verification failed\. errorType=QueryFailedError sqlState=23505/u);
		assert.equal(loggedErrors.includes(RAW_FAILURE_CANARY), false);

		await rotatorService.beforeApplicationShutdown();
	});

	it("initializes replacements without schema side effects and preserves the live cache owner", async () => {
		const events = [];

		const liveCache = {
			disconnectCalls: 0,
			async disconnect() {
				this.disconnectCalls += 1;
			},
		};

		const replacementCache = {
			disconnectCalls: 0,
			async disconnect() {
				this.disconnectCalls += 1;
			},
		};

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
			options: {
				cache: {
					duration: 1_000,
					type: "database",
				},
				dropSchema: true,
				installExtensions: true,
				migrationsRun: true,
				synchronize: true,
			},
		});

		liveDataSource.queryResultCache = liveCache;

		const replacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});

		replacement.queryResultCache = replacementCache;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => ({
				...liveDataSource.options,
				password: "rotated-password",
			}),
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:safe-initialize", replacement);

		await rotatorService.rotateDatabaseConnection();

		assert.equal(replacement.createdWithOptions.dropSchema, false);
		assert.equal(replacement.createdWithOptions.installExtensions, false);
		assert.equal(replacement.createdWithOptions.migrationsRun, false);
		assert.equal(replacement.createdWithOptions.synchronize, false);
		assert.equal(replacementCache.disconnectCalls, 1);
		assert.equal("queryResultCache" in replacement, false);
		assert.equal(liveDataSource.queryResultCache, liveCache);
		assert.equal(liveCache.disconnectCalls, 0);
		assert.equal(liveDataSource.options.dropSchema, true);
		assert.equal(liveDataSource.options.migrationsRun, true);
		assert.equal(liveDataSource.options.synchronize, true);

		await rotatorService.beforeApplicationShutdown();
	});

	it("defers after a retiring close failure and resumes only after that generation closes", async (testContext) => {
		const events = [];
		const errorLogger = testContext.mock.method(Logger.prototype, "error", () => undefined);
		let retiringDisconnectAttempts = 0;

		const liveDataSource = createFakeDataSource({
			disconnectImplementation: async () => {
				retiringDisconnectAttempts += 1;

				if (retiringDisconnectAttempts <= 2) {
					throw createLogCanaryFailure();
				}
			},
			label: "generation-0",
		});

		const firstReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});

		const secondReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-2",
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsCalls === 1 ? firstReplacement.options : secondReplacement.options;
			},
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:close-retry", [firstReplacement, secondReplacement]);

		await rotatorService.rotateDatabaseConnection();
		assert.equal(liveDataSource.driver.label, "generation-1");
		assert.equal(retiringDisconnectAttempts, 1);

		await rotatorService.rotateDatabaseConnection();
		assert.equal(liveDataSource.driver.label, "generation-1");
		assert.equal(secondReplacement.initializeCalls, 0);
		assert.equal(optionsCalls, 1);
		assert.ok(events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_CLOSE_FAILED));

		await rotatorService.rotateDatabaseConnection();
		assert.equal(retiringDisconnectAttempts, 3);
		assert.equal(liveDataSource.driver.label, "generation-2");
		assert.equal(optionsCalls, 2);
		assert.equal(firstReplacement.driver.state.disconnectCalls, 1);

		const loggedErrors = readLoggedErrors(errorLogger);

		assert.match(loggedErrors, /Retiring database generation close failed\. errorType=Error sqlState=23505/u);
		assert.equal(loggedErrors.includes(RAW_FAILURE_CANARY), false);

		await rotatorService.beforeApplicationShutdown();
	});

	it("retries a failed QueryRunner release and decrements each runner exactly once", async () => {
		const events = [];

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const firstReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});

		const secondReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-2",
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsCalls === 1 ? firstReplacement.options : secondReplacement.options;
			},
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:release-accounting", [firstReplacement, secondReplacement]);

		await rotatorService.rotateDatabaseConnection();

		const firstQueryRunner = liveDataSource.createQueryRunner();
		const secondQueryRunner = liveDataSource.createQueryRunner();
		let shouldFailFirstRelease = true;

		firstReplacement.behavior.releaseImplementation = async (queryRunner) => {
			if (queryRunner === firstQueryRunner && shouldFailFirstRelease) {
				shouldFailFirstRelease = false;

				throw new Error("query runner release failed");
			}
		};

		await firstQueryRunner.query("SELECT first_runner");
		await secondQueryRunner.query("SELECT second_runner");
		await rotatorService.rotateDatabaseConnection();

		await assert.rejects(firstQueryRunner.release(), /Failed to release a tracked database query runner\. errorType=Error/);
		await secondQueryRunner.release();
		await flushAsyncWork();
		assert.equal(firstReplacement.driver.state.disconnectCalls, 0);

		await firstQueryRunner.release();
		await waitFor(() => firstReplacement.driver.state.disconnectCalls === 1, "The retiring generation did not close after the release retry succeeded.");

		await firstQueryRunner.release();
		assert.equal(firstReplacement.driver.state.disconnectCalls, 1);

		await rotatorService.beforeApplicationShutdown();
	});

	it("waits for current and retiring query runners before a graceful shutdown", async () => {
		const events = [];

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const firstReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});

		const secondReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-2",
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsCalls === 1 ? firstReplacement.options : secondReplacement.options;
			},
			shutdownDrainTimeoutMs: 5_000,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:graceful-shutdown", [firstReplacement, secondReplacement]);

		await rotatorService.rotateDatabaseConnection();

		events.length = 0;

		const retiringQueryRunner = liveDataSource.createQueryRunner();

		await rotatorService.rotateDatabaseConnection();

		const currentQueryRunner = liveDataSource.createQueryRunner();
		let didShutdownSettle = false;

		const shutdownPromise = rotatorService.beforeApplicationShutdown().finally(() => {
			didShutdownSettle = true;
		});

		await flushAsyncWork();
		assert.equal(didShutdownSettle, false);
		assert.throws(() => liveDataSource.createQueryRunner(), /shutdown is in progress/);

		await retiringQueryRunner.release();
		await flushAsyncWork();
		assert.equal(didShutdownSettle, false);

		await currentQueryRunner.release();
		await shutdownPromise;

		assert.equal(liveDataSource.isInitialized, false);
		assert.equal(liveDataSource.destroyCalls, 1);
		assert.equal(events.filter((event) => event.type === ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED && event.isForced === false).length, 2);
		assert.equal(
			events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT),
			false,
		);
	});

	it("force-closes best effort and returns an aggregate error after the drain timeout", async () => {
		const events = [];

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const firstReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});

		const secondReplacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-2",
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsCalls === 1 ? firstReplacement.options : secondReplacement.options;
			},
			shutdownDrainTimeoutMs: 10,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:drain-timeout", [firstReplacement, secondReplacement]);

		await rotatorService.rotateDatabaseConnection();

		events.length = 0;

		const retiringQueryRunner = liveDataSource.createQueryRunner();

		await rotatorService.rotateDatabaseConnection();

		const currentQueryRunner = liveDataSource.createQueryRunner();
		const startedAt = Date.now();

		await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => error instanceof AggregateError && error.message === "Database rotation shutdown failed." && error.errors.some((shutdownError) => shutdownError.message.includes("did not drain within 10 ms")));

		assert.ok(Date.now() - startedAt < 100);
		assert.equal(liveDataSource.isInitialized, false);
		assert.equal(liveDataSource.destroyCalls, 1);
		assert.deepEqual(
			events.find((event) => event.type === ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT && event.phase === ETypeOrmAwsConnectorDrainTimeoutPhase.DRAIN),
			{
				activeQueryRunnerCount: 2,
				currentGeneration: 2,
				phase: ETypeOrmAwsConnectorDrainTimeoutPhase.DRAIN,
				retiringGeneration: 1,
				shutdownDrainTimeoutMs: 10,
				type: ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT,
			},
		);
		assert.equal(events.filter((event) => event.type === ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED && event.isForced === true).length, 2);
		assert.equal(retiringQueryRunner.isReleased, true);
		assert.equal(currentQueryRunner.isReleased, true);

		await retiringQueryRunner.release();
		await currentQueryRunner.release();
	});

	it("releases tracked MySQL runners before force-closing pools that cannot release clients", async () => {
		const events = [];
		const neverSettles = new Promise(() => {});

		const createMysqlDataSource = (label, isInitialized = true) =>
			createFakeDataSource({
				disconnectImplementation: async (driver) => {
					if (driver.state.queryRunners.size > 0) {
						await neverSettles;
					}
				},
				disconnectReleasesQueryRunners: false,
				isInitialized,
				label,
				options: {
					type: "mysql",
				},
			});
		const liveDataSource = createMysqlDataSource("generation-0");
		const firstReplacement = createMysqlDataSource("generation-1", false);
		const secondReplacement = createMysqlDataSource("generation-2", false);
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsCalls === 1 ? firstReplacement.options : secondReplacement.options;
			},
			shutdownDrainTimeoutMs: 10,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:mysql-force-close", [firstReplacement, secondReplacement]);

		await rotatorService.rotateDatabaseConnection();

		events.length = 0;

		const retiringQueryRunner = liveDataSource.createQueryRunner();

		await rotatorService.rotateDatabaseConnection();

		const currentQueryRunner = liveDataSource.createQueryRunner();

		await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => error instanceof AggregateError && error.errors.some((shutdownError) => shutdownError.message.includes("did not drain within 10 ms")));

		assert.equal(retiringQueryRunner.isReleased, true);
		assert.equal(currentQueryRunner.isReleased, true);
		assert.equal(firstReplacement.driver.state.disconnectCalls, 1);
		assert.equal(secondReplacement.driver.state.disconnectCalls, 1);
		assert.equal(
			events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT && event.phase === ETypeOrmAwsConnectorDrainTimeoutPhase.GENERATION_CLOSE),
			false,
		);
	});

	it("aggregates retiring and current generation close failures", async () => {
		const events = [];

		const liveDataSource = createFakeDataSource({
			disconnectImplementation: async () => {
				throw new Error("retiring disconnect failed");
			},
			label: "generation-0",
		});

		const firstReplacement = createFakeDataSource({
			disconnectImplementation: async () => {
				throw new Error("current disconnect failed");
			},
			isInitialized: false,
			label: "generation-1",
		});

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => firstReplacement.options,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:aggregate-close", firstReplacement);

		await rotatorService.rotateDatabaseConnection();

		await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => {
			assert.ok(error instanceof AggregateError);
			assert.equal(error.errors.length, 2);
			assert.ok(error.errors.some((shutdownError) => shutdownError.message.includes("Failed to close the current database generation during shutdown. errorType=Error")));
			assert.ok(error.errors.some((shutdownError) => shutdownError.message.includes("Failed to close the retiring database generation. errorType=Error")));

			return true;
		});
	});

	it("bounds a hanging generation close and emits a timeout event", async () => {
		const originalSetInterval = globalThis.setInterval;
		const events = [];
		const neverSettles = new Promise(() => {});
		const schedulerRegistry = createFakeSchedulerRegistry();

		const liveDataSource = createFakeDataSource({
			disconnectImplementation: async () => neverSettles,
			label: "generation-0",
		});

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => liveDataSource.options,
			shutdownDrainTimeoutMs: 10,
		});

		globalThis.setInterval = (callback, timeout) => ({
			callback,
			timeout,
		});

		try {
			const rotatorService = new TestRotatorService(liveDataSource, schedulerRegistry, connectorService, "db-rotation:hanging-close", []);

			rotatorService.onModuleInit();

			const startedAt = Date.now();

			await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => error instanceof AggregateError && error.errors.some((shutdownError) => shutdownError.message.includes("close did not settle within 10 ms")));

			assert.ok(Date.now() - startedAt < 100);
			assert.deepEqual(
				events.find((event) => event.type === ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT),
				{
					activeQueryRunnerCount: 0,
					currentGeneration: 0,
					phase: ETypeOrmAwsConnectorDrainTimeoutPhase.GENERATION_CLOSE,
					retiringGeneration: null,
					shutdownDrainTimeoutMs: 10,
					type: ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT,
				},
			);
			assert.equal(schedulerRegistry.intervals.size, 0);
		} finally {
			globalThis.setInterval = originalSetInterval;
		}
	});

	it("isolates asynchronous event-listener failures and reports an uninitialized data source", async (testContext) => {
		const events = [];
		const errorLogger = testContext.mock.method(Logger.prototype, "error", () => undefined);

		const liveDataSource = createFakeDataSource({
			isInitialized: false,
			label: "generation-0",
		});

		const connectorService = {
			getRotationConfig: () => ({
				intervalMs: 1_000,
				isEnabled: true,
				onEvent: async (event) => {
					events.push(event);

					throw createLogCanaryFailure();
				},
				shutdownDrainTimeoutMs: 100,
			}),
			getTypeOrmOptions: async () => {
				throw new Error("Fresh options must not be requested for an uninitialized data source.");
			},
		};
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:listener-failure", []);

		await rotatorService.rotateDatabaseConnection();
		await flushAsyncWork();

		assert.deepEqual(events, [
			{
				currentGeneration: 0,
				reason: ETypeOrmAwsConnectorRotationDeferredReason.DATA_SOURCE_NOT_INITIALIZED,
				retiringGeneration: null,
				retiringGenerationActiveQueryRunnerCount: 0,
				type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED,
			},
		]);
		assert.ok(Object.isFrozen(events[0]));

		const loggedErrors = readLoggedErrors(errorLogger);

		assert.match(loggedErrors, /Database rotation event listener failed\. errorType=QueryFailedError sqlState=23505/u);
		assert.equal(loggedErrors.includes(RAW_FAILURE_CANARY), false);

		await rotatorService.beforeApplicationShutdown();
	});

	it("stops an in-flight credentials fetch before constructing a replacement during shutdown", async () => {
		const events = [];
		const optionsDeferred = createDeferred();

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const replacement = createFakeDataSource({
			isInitialized: false,
			label: "generation-1",
		});
		let optionsCalls = 0;

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => {
				optionsCalls += 1;

				return optionsDeferred.promise;
			},
			shutdownDrainTimeoutMs: 1_000,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:shutdown-fetch-race", replacement);
		const rotationPromise = rotatorService.rotateDatabaseConnection();

		await waitFor(() => optionsCalls === 1, "The credentials fetch did not start.");

		const shutdownPromise = rotatorService.beforeApplicationShutdown();

		optionsDeferred.resolve(replacement.options);
		await rotationPromise;
		await shutdownPromise;

		assert.equal(replacement.initializeCalls, 0);
		assert.equal(liveDataSource.driver.label, "generation-0");
		assert.ok(events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS));
	});

	it("bounds shutdown while replacement initialization is hung and never promotes it later", async () => {
		const events = [];
		const initializationDeferred = createDeferred();

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const replacement = createFakeDataSource({
			initializeImplementation: async () => initializationDeferred.promise,
			isInitialized: false,
			label: "generation-1",
		});

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => replacement.options,
			shutdownDrainTimeoutMs: 10,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:hung-initialize", replacement);
		const rotationPromise = rotatorService.rotateDatabaseConnection();

		await waitFor(() => replacement.initializeCalls === 1, "The replacement did not begin initialization.");

		const startedAt = Date.now();

		await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => error instanceof AggregateError && error.errors.some((shutdownError) => shutdownError.message.includes("did not drain within 10 ms")));

		assert.ok(Date.now() - startedAt < 100);
		assert.equal(replacement.driver.state.disconnectCalls, 1);
		assert.equal(liveDataSource.driver.label, "generation-0");

		initializationDeferred.resolve();
		await rotationPromise;

		assert.equal(liveDataSource.driver.label, "generation-0");
		assert.equal(replacement.destroyCalls, 1);
		assert.equal(replacement.driver.state.disconnectCalls, 2);
	});

	it("includes an initialized pending-replacement close failure in the shutdown aggregate", async () => {
		const events = [];
		const verificationDeferred = createDeferred();

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const replacement = createFakeDataSource({
			destroyImplementation: async () => {
				throw new Error("pending replacement close failed");
			},
			isInitialized: false,
			label: "generation-1",
			queryImplementation: async () => verificationDeferred.promise,
		});

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => replacement.options,
			shutdownDrainTimeoutMs: 10,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:pending-close-failure", replacement);
		const rotationPromise = rotatorService.rotateDatabaseConnection();

		await waitFor(() => replacement.driver.state.queryCalls.length === 1, "Replacement verification did not start.");

		await assert.rejects(rotatorService.beforeApplicationShutdown(), (error) => {
			assert.ok(error instanceof AggregateError);
			assert.ok(error.errors.some((shutdownError) => shutdownError.message.includes("did not drain within 10 ms")));
			assert.ok(error.errors.some((shutdownError) => shutdownError.message.includes("Failed to close the pending replacement DataSource during shutdown. errorType=Error")));

			return true;
		});

		verificationDeferred.resolve([{ ok: 1 }]);
		await assert.rejects(rotationPromise, /replacement DataSource could not be closed|pending replacement close failed/);

		assert.equal(liveDataSource.driver.label, "generation-0");
	});

	it("prevents an initializing replacement from being promoted after shutdown starts", async () => {
		const events = [];
		const initializationDeferred = createDeferred();

		const liveDataSource = createFakeDataSource({
			label: "generation-0",
		});

		const replacement = createFakeDataSource({
			initializeImplementation: async () => initializationDeferred.promise,
			isInitialized: false,
			label: "generation-1",
		});

		const connectorService = createConnectorService({
			events,
			getTypeOrmOptions: async () => replacement.options,
		});
		const rotatorService = new TestRotatorService(liveDataSource, createFakeSchedulerRegistry(), connectorService, "db-rotation:shutdown-race", replacement);
		const rotationPromise = rotatorService.rotateDatabaseConnection();

		await waitFor(() => replacement.initializeCalls === 1, "The replacement did not begin initialization.");

		const shutdownPromise = rotatorService.beforeApplicationShutdown();

		initializationDeferred.resolve();
		await rotationPromise;
		await shutdownPromise;

		assert.equal(liveDataSource.driver.label, "generation-0");
		assert.equal(replacement.destroyCalls, 1);
		assert.equal(replacement.driver.state.disconnectCalls, 1);
		assert.ok(events.some((event) => event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.SHUTDOWN_IN_PROGRESS));
	});
});
