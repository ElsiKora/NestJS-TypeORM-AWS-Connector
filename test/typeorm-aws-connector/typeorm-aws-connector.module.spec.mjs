import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NestFactory } from "@nestjs/core";
import { RotatorService, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";

import { CORE_DATABASE_CONFIG } from "./core-database-config.constant.mjs";
import { CORE_DATA_SOURCE } from "./core-data-source.constant.mjs";
import { CoreConnectorProbeService } from "./core-connector-probe.service.mjs";
import { LegacyConnectorProbeService } from "./legacy-connector-probe.service.mjs";
import { PROVIDER_DATABASE_CONFIG } from "./provider-database-config.constant.mjs";
import { PROVIDER_DATA_SOURCE } from "./provider-data-source.constant.mjs";
import { ProviderConnectorProbeService } from "./provider-connector-probe.service.mjs";
import { TestAppModule } from "./test-app.module.mjs";

const DEFAULT_FAKE_OPTIONS = {
	database: "app",
	entities: [],
	extra: {
		max: 10,
	},
	host: "db-host",
	logging: false,
	password: "old-password",
	port: 5432,
	relationLoadStrategy: "query",
	synchronize: false,
	type: "postgres",
	username: "old-user",
};

const cloneExtraOptions = (value) => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return {};
	}

	return {
		...value,
	};
};

const createFakeDriver = (label, dataSource) => {
	const state = {
		disconnectCalls: 0,
		queryCalls: [],
	};

	const driver = {
		connection: dataSource,
		createQueryRunner: (mode = "master") => {
			const queryRunner = {
				connection: dataSource,
				driver: undefined,
				isReleased: false,
				manager: undefined,
				mode,
				query: async (query) => {
					state.queryCalls.push(query);

					return [{ ok: 1 }];
				},
				release: async () => {
					queryRunner.isReleased = true;
				},
			};

			queryRunner.driver = driver;

			return queryRunner;
		},
		disconnect: async () => {
			state.disconnectCalls += 1;
		},
		label,
		options: dataSource.options,
		state,
	};

	return driver;
};

const createFakeDataSource = ({ label, options = {} }) => {
	const dataSource = {
		createQueryRunner(mode = "master") {
			return dataSource.driver.createQueryRunner(mode);
		},
		destroyCalls: 0,
		driver: undefined,
		initialize: async () => {
			dataSource.isInitialized = true;

			return dataSource;
		},
		isInitialized: true,
		options: {
			...DEFAULT_FAKE_OPTIONS,
			...options,
			extra: {
				...cloneExtraOptions(DEFAULT_FAKE_OPTIONS.extra),
				...cloneExtraOptions(options.extra),
			},
		},
		setOptions(nextOptions) {
			dataSource.options = {
				...dataSource.options,
				...nextOptions,
				extra: {
					...cloneExtraOptions(dataSource.options.extra),
					...cloneExtraOptions(nextOptions.extra),
				},
			};
			dataSource.driver.options = dataSource.options;

			return dataSource;
		},
		destroy: async () => {
			dataSource.destroyCalls += 1;
			dataSource.isInitialized = false;
		},
	};

	const driver = createFakeDriver(label, dataSource);

	dataSource.driver = driver;

	return dataSource;
};

class TestRotatorService extends RotatorService {
	constructor(dataSource, schedulerRegistry, connectorService, rotationIntervalName, replacementDataSource) {
		super(dataSource, schedulerRegistry, connectorService, rotationIntervalName);
		this.replacementDataSource = replacementDataSource;
	}

	createReplacementDataSource() {
		return this.replacementDataSource;
	}
}

describe("TypeOrmAwsConnectorModule", () => {
	it("isolates multiple connector registrations in one Nest application", async () => {
		const app = await NestFactory.createApplicationContext(TestAppModule, {
			logger: false,
		});

		try {
			const coreProbe = app.get(CoreConnectorProbeService);
			const providerProbe = app.get(ProviderConnectorProbeService);
			const legacyProbe = app.get(LegacyConnectorProbeService);
			const coreOptions = await coreProbe.connectorService.getTypeOrmOptions();
			const providerOptions = await providerProbe.connectorService.getTypeOrmOptions();
			const legacyOptions = await legacyProbe.connectorService.getTypeOrmOptions();

			assert.notStrictEqual(coreProbe.connectorService, providerProbe.connectorService);
			assert.notStrictEqual(coreProbe.rotatorService, providerProbe.rotatorService);
			assert.equal(coreOptions.database, CORE_DATABASE_CONFIG.databaseName);
			assert.equal(coreOptions.host, CORE_DATABASE_CONFIG.host);
			assert.equal(coreOptions.port, CORE_DATABASE_CONFIG.port);
			assert.equal(coreOptions.username, CORE_DATABASE_CONFIG.username);
			assert.equal(coreOptions.password, CORE_DATABASE_CONFIG.password);
			assert.equal(providerOptions.database, PROVIDER_DATABASE_CONFIG.databaseName);
			assert.equal(providerOptions.host, PROVIDER_DATABASE_CONFIG.host);
			assert.equal(providerOptions.port, PROVIDER_DATABASE_CONFIG.port);
			assert.equal(providerOptions.username, PROVIDER_DATABASE_CONFIG.username);
			assert.equal(providerOptions.password, PROVIDER_DATABASE_CONFIG.password);
			assert.equal(legacyOptions.database, CORE_DATABASE_CONFIG.databaseName);
			assert.equal(legacyOptions.host, CORE_DATABASE_CONFIG.host);
			assert.equal(coreProbe.rotatorService.dataSource, CORE_DATA_SOURCE);
			assert.equal(providerProbe.rotatorService.dataSource, PROVIDER_DATA_SOURCE);
		} finally {
			await app.close();
		}
	});

	it("registers unique rotation interval names per connector instance", () => {
		const intervalNames = [];
		const originalSetInterval = globalThis.setInterval;

		const schedulerRegistry = {
			addInterval: (name) => {
				intervalNames.push(name);
			},
		};

		const connectorService = {
			getRotationConfig: () => ({
				intervalMs: 1_000,
				isEnabled: true,
			}),
		};

		const firstDataSource = createFakeDataSource({
			label: "first",
		});

		const secondDataSource = createFakeDataSource({
			label: "second",
		});

		globalThis.setInterval = (callback, timeout) => ({ callback, timeout });

		try {
			const firstRotatorService = new RotatorService(firstDataSource, schedulerRegistry, connectorService, "db-rotation:1");
			const secondRotatorService = new RotatorService(secondDataSource, schedulerRegistry, connectorService, "db-rotation:2");

			firstRotatorService.onModuleInit();
			secondRotatorService.onModuleInit();

			assert.deepEqual(intervalNames, ["db-rotation:1", "db-rotation:2"]);
		} finally {
			globalThis.setInterval = originalSetInterval;
		}
	});

	it("preserves the legacy single-instance class injection path", async () => {
		const app = await NestFactory.createApplicationContext(TestAppModule, {
			logger: false,
		});

		try {
			const legacyProbe = app.get(LegacyConnectorProbeService);

			assert.ok(legacyProbe.connectorService instanceof TypeOrmAwsConnectorService);
			assert.ok(legacyProbe.rotatorService instanceof RotatorService);
		} finally {
			await app.close();
		}
	});

	it("skips interval registration when rotation is disabled in config", () => {
		let addIntervalCalls = 0;

		const schedulerRegistry = {
			addInterval: () => {
				addIntervalCalls += 1;
			},
		};

		const connectorService = {
			getRotationConfig: () => ({
				intervalMs: 1_000,
				isEnabled: false,
			}),
		};
		const rotatorService = new RotatorService(undefined, schedulerRegistry, connectorService, "db-rotation:disabled");

		rotatorService.onModuleInit();

		assert.equal(addIntervalCalls, 0);
	});

	it("resolves rotation config from SSM when raw overrides are not provided", () => {
		const resolvedLookups = [];

		const connectorService = new TypeOrmAwsConnectorService(
			{
				get: () => undefined,
			},
			{
				get: (lookup) => {
					resolvedLookups.push(lookup.path.join("/"));

					if (lookup.path.join("/") === "typeorm/rotation/interval-ms") {
						return "600000";
					}

					if (lookup.path.join("/") === "typeorm/rotation/enabled") {
						return "true";
					}

					return null;
				},
			},
			{
				entities: [],
			},
		);

		assert.deepEqual(connectorService.getRotationConfig(), {
			intervalMs: 600_000,
			isEnabled: true,
		});
		assert.deepEqual(resolvedLookups, ["typeorm/rotation/interval-ms", "typeorm/rotation/enabled"]);
	});

	it("promotes a verified replacement driver without destroying the live data source", async () => {
		const originalSetInterval = globalThis.setInterval;

		const liveDataSource = createFakeDataSource({
			label: "live",
			options: {
				extra: {
					applicationName: "rotation-test",
					max: 10,
				},
			},
		});
		const originalDriver = liveDataSource.driver;

		const replacementDataSource = createFakeDataSource({
			label: "replacement",
			options: {
				extra: {
					idleTimeoutMillis: 30_000,
					max: 20,
				},
				host: "rotated-host",
				password: "new-password",
				username: "new-user",
			},
		});

		const connectorService = {
			getRotationConfig: () => ({
				intervalMs: 1_000,
				isEnabled: true,
			}),
			getTypeOrmOptions: async () => replacementDataSource.options,
		};

		const schedulerRegistry = {
			addInterval: () => undefined,
		};

		globalThis.setInterval = () => ({
			callback: undefined,
			timeout: 1_000,
		});

		try {
			const rotatorService = new TestRotatorService(liveDataSource, schedulerRegistry, connectorService, "db-rotation:test", replacementDataSource);

			rotatorService.onModuleInit();

			const inFlightQueryRunner = liveDataSource.createQueryRunner();

			assert.equal(inFlightQueryRunner.driver.label, "live");

			await rotatorService.rotateDatabaseConnection();

			assert.equal(liveDataSource.destroyCalls, 0);
			assert.equal(replacementDataSource.destroyCalls, 0);
			assert.equal(liveDataSource.driver.label, "replacement");
			assert.equal(liveDataSource.driver.connection, liveDataSource);
			assert.equal(liveDataSource.options.host, "rotated-host");
			assert.equal(liveDataSource.options.password, "new-password");
			assert.equal(liveDataSource.options.username, "new-user");
			assert.equal(liveDataSource.options.extra.applicationName, "rotation-test");
			assert.equal(liveDataSource.options.extra.idleTimeoutMillis, 30_000);
			assert.equal(liveDataSource.options.extra.max, 20);
			assert.equal(originalDriver.state.disconnectCalls, 0);

			const rotatedQueryRunner = liveDataSource.createQueryRunner();

			assert.equal(rotatedQueryRunner.driver.label, "replacement");

			await rotatedQueryRunner.release();
			await inFlightQueryRunner.release();

			assert.equal(originalDriver.state.disconnectCalls, 1);
		} finally {
			globalThis.setInterval = originalSetInterval;
		}
	});
});
