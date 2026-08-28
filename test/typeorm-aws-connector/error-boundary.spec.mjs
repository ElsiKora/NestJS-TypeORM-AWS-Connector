import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";

import { FormatErrorEvidence } from "../../dist/esm/shared/utility/error-evidence.utility.js";

const RAW_FAILURE_CANARY = "SELECT secret FROM ledger WHERE profile='prod' host=10.0.0.7 url=https://private.invalid password=exposed";

const assertBoundedFailure = (failure, cause, context) => {
	assert.ok(failure instanceof Error);
	assert.notStrictEqual(failure, cause);
	assert.strictEqual(failure.cause, cause);
	assert.match(failure.message, new RegExp(`^${context.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\. errorType=[A-Za-z][A-Za-z0-9]{0,63}(?: sqlState=[0-9A-Z]{5})?$`, "u"));
	assert.equal(failure.message.includes(RAW_FAILURE_CANARY), false);
};

const createConnectorService = (databaseConfig, parameterStoreConfigService = { get: () => null }) =>
	new TypeOrmAwsConnectorService(
		{
			get: () => undefined,
		},
		parameterStoreConfigService,
		databaseConfig,
	);

const createForeignFailure = () => {
	const failure = new Error(RAW_FAILURE_CANARY);

	failure.name = "QueryFailedError";
	failure.driverError = {
		code: "23505",
		message: RAW_FAILURE_CANARY,
		parameters: [RAW_FAILURE_CANARY],
		query: RAW_FAILURE_CANARY,
		stack: RAW_FAILURE_CANARY,
	};
	failure.stack = RAW_FAILURE_CANARY;

	return failure;
};

describe("Connector bounded error evidence", () => {
	it("formats only a validated error type and SQLSTATE without evaluating arbitrary facts", () => {
		const failure = createForeignFailure();

		assert.equal(FormatErrorEvidence(failure), "errorType=QueryFailedError sqlState=23505");
		assert.equal(FormatErrorEvidence({ code: "23505", name: "DriverFailure\nsecret" }), "errorType=Object sqlState=23505");
		assert.equal(FormatErrorEvidence({ code: "2350", name: "DriverFailure" }), "errorType=DriverFailure");
		assert.equal(FormatErrorEvidence({ code: "23505", name: "x".repeat(65) }), "errorType=Object sqlState=23505");
		assert.equal(FormatErrorEvidence("raw secret"), "errorType=UnknownError");

		class DriverFailure extends Error {}

		assert.equal(FormatErrorEvidence(new DriverFailure()), "errorType=DriverFailure");

		let getterCalls = 0;
		const accessorFailure = {};

		for (const property of ["cause", "code", "driverError", "message", "name", "stack"]) {
			Object.defineProperty(accessorFailure, property, {
				configurable: true,
				get: () => {
					getterCalls += 1;

					throw new Error(RAW_FAILURE_CANARY);
				},
			});
		}

		assert.equal(FormatErrorEvidence(accessorFailure), "errorType=Object");
		assert.equal(getterCalls, 0);

		const hostileProxy = new Proxy(
			{},
			{
				getOwnPropertyDescriptor: () => {
					throw new Error(RAW_FAILURE_CANARY);
				},
				getPrototypeOf: () => {
					throw new Error(RAW_FAILURE_CANARY);
				},
			},
		);

		assert.equal(FormatErrorEvidence(hostileProxy), "errorType=UnknownError");

		const cyclicFailure = { name: "CyclicFailure" };

		cyclicFailure.cause = cyclicFailure;
		assert.equal(FormatErrorEvidence(cyclicFailure), "errorType=CyclicFailure");
	});

	it("forces TypeORM logging off and never resolves the removed logging lookup", async () => {
		const resolvedPaths = [];

		const connectorService = createConnectorService(
			{
				databaseName: "database",
				entities: [],
				host: "127.0.0.1",
				isVerbose: true,
				password: "password",
				port: 5432,
				type: "postgres",
				username: "username",
			},
			{
				get: (lookup) => {
					resolvedPaths.push(lookup.path.join("/"));

					return null;
				},
			},
		);
		const options = await connectorService.getTypeOrmOptions();

		assert.equal(options.logging, false);
		assert.equal(resolvedPaths.includes("typeorm/logging"), false);
	});

	it("wraps SSM and Secrets Manager failures without copying foreign facts", async () => {
		const ssmFailure = createForeignFailure();

		const ssmService = createConnectorService(
			{ entities: [] },
			{
				get: () => {
					throw ssmFailure;
				},
			},
		);

		assert.throws(
			() => ssmService.getRotationConfig(),
			(failure) => {
				assertBoundedFailure(failure, ssmFailure, "Failed to resolve AWS Systems Manager Parameter Store value");

				return true;
			},
		);

		const secretsManagerFailure = createForeignFailure();

		const secretsManagerService = createConnectorService({
			entities: [],
			secretId: "private/secret/profile",
		});

		secretsManagerService.getCredentialsSecretClient = () => ({
			send: async () => {
				throw secretsManagerFailure;
			},
		});

		await assert.rejects(secretsManagerService.getCredentials(), (failure) => {
			assertBoundedFailure(failure, secretsManagerFailure, "Failed to load secret from AWS Secrets Manager");
			assert.equal(failure.message.includes("private/secret/profile"), false);

			return true;
		});
	});

	it("keeps the runtime sources free from raw foreign-error sinks", async () => {
		const runtimePaths = ["src/modules/typeorm-aws-connector/rotator/rotator.service.ts", "src/modules/typeorm-aws-connector/typeorm-aws-connector.service.ts", "src/shared/utility/error-evidence.utility.ts"];
		const runtimeSource = (await Promise.all(runtimePaths.map(async (path) => readFile(path, "utf8")))).join("\n");
		const packageEntrySource = await readFile("src/index.ts", "utf8");

		assert.doesNotMatch(runtimeSource, /\.(?:message|stack)\b/u);
		assert.doesNotMatch(runtimeSource, /JSON\.stringify\s*\(/u);
		assert.doesNotMatch(runtimeSource, /String\s*\(\s*(?:error|[A-Za-z]*Error|releaseResult\.reason)\s*\)/u);
		assert.deepEqual(runtimeSource.match(/\blogging\s*:[^,\n]+/gu), ["logging: false"]);
		assert.doesNotMatch(packageEntrySource, /error-evidence/u);
	});
});
