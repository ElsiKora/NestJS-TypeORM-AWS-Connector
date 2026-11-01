import type { DynamicModule, INestApplicationContext } from "@nestjs/common";
import type { Repository } from "typeorm";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { RotatorService } from "@elsikora/nestjs-typeorm-aws-connector";
import { NestFactory } from "@nestjs/core";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

import { type IAwsStub, type IAwsStubDatabase, parseDatabaseUrl, startAwsStub } from "./aws-stub.js";
import { AppModule, retiredGenerations } from "./module.js";
import { NoteEntity } from "./note.entity.js";

import "reflect-metadata";

/**
 * Starts a Nest 12 application with the connector against Postgres, writes and reads an entity, rotates the
 * credentials through the TypeORM 1 driver swap, checks the AWS calls and closes the application.
 * @param {string} name - Scenario name.
 * @param {(endpoint: string) => DynamicModule} createModule - Builds the application module for the stub endpoint.
 * @returns {Promise<void>}
 */
async function runScenario(name: string, createModule: (endpoint: string) => DynamicModule): Promise<void> {
	const database: IAwsStubDatabase = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
	const stub: IAwsStub = await startAwsStub(database);

	// The connector creates its Secrets Manager client from the environment, as in an AWS runtime
	process.env.AWS_ACCESS_KEY_ID = "smoke";
	process.env.AWS_ENDPOINT_URL_SECRETS_MANAGER = stub.endpoint;
	process.env.AWS_MAX_ATTEMPTS = "1";
	process.env.AWS_REGION = "us-east-1";
	process.env.AWS_SECRET_ACCESS_KEY = "smoke";
	retiredGenerations.length = 0;

	let app: INestApplicationContext | undefined;

	try {
		app = await NestFactory.createApplicationContext(createModule(stub.endpoint), { abortOnError: false, logger: false });
		const dataSource: DataSource = app.get(DataSource);
		const notes: Repository<NoteEntity> = app.get(getRepositoryToken(NoteEntity));
		const id: string = randomUUID();

		assert.equal(dataSource.isInitialized, true);
		assert.equal(dataSource.options.type, "postgres");
		assert.equal((dataSource.options as { host?: string }).host, database.host);
		assert.equal((dataSource.options as { username?: string }).username, database.username);
		await notes.save({ id, text: name });

		await app.get(RotatorService).rotateDatabaseConnection();
		// Every TypeORM 1 driver class has dataSource, the Driver interface does not declare it
		assert.equal((dataSource.driver as unknown as { dataSource: DataSource }).dataSource, dataSource);
		const note: NoteEntity = await notes.findOneByOrFail({ id });

		assert.deepEqual({ id: note.id, text: note.text }, { id, text: name });

		for (let attempt: number = 0; attempt < 50 && retiredGenerations.length === 0; attempt += 1) {
			await new Promise<void>((resolve: () => void) => setTimeout(resolve, 20));
		}

		assert.deepEqual(retiredGenerations, [0]);
		assert.deepEqual(
			stub.targets.filter((target: string) => target === "secretsmanager.GetSecretValue"),
			["secretsmanager.GetSecretValue", "secretsmanager.GetSecretValue"],
		);
		assert.equal(stub.targets.includes("AmazonSSM.GetParametersByPath"), true);

		await notes.delete({ id });
		await app.close();
		app = undefined;
		assert.equal(dataSource.isInitialized, false);
		process.stdout.write(`PASS ${name}\n`);
	} finally {
		// A failed assertion must not leave the pool and the rotation interval holding the process open
		await app?.close();
		await stub.close();
	}
}

// No top-level await: the commonjs consumers compile this file to CommonJS
void (async () => {
	await runScenario("register", (endpoint: string) => AppModule.withRegister(endpoint));
	await runScenario("registerAsync", (endpoint: string) => AppModule.withRegisterAsync(endpoint));
})().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
	process.exitCode = 1;
});
