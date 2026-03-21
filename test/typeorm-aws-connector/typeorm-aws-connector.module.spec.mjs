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
		const dataSource = {};

		globalThis.setInterval = (callback, timeout) => ({ callback, timeout });

		try {
			const firstRotatorService = new RotatorService(dataSource, schedulerRegistry, connectorService, "db-rotation:1");
			const secondRotatorService = new RotatorService(dataSource, schedulerRegistry, connectorService, "db-rotation:2");

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
});
