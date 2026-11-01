#!/usr/bin/env node
/**
 * Consumer smoke test for the packed package.
 *
 * Packs the built package and installs the tarball with the peer stack into a temporary project.
 * It first checks that importing the package (ESM import and CommonJS require) prints nothing and
 * leaves process.env alone even with a .env file in the working directory. Then, for every consumer
 * in test/consumer (ESM bundler, ESM nodenext, and CommonJS node10 and default resolution through
 * require(esm)), it typechecks the shared app in test/consumer/app/src and runs it: the app starts and
 * closes a Nest 12 application context with register and registerAsync, with the parameters from a
 * local SSM stub and the credentials from a local Secrets Manager stub, writes an entity to Postgres
 * and rotates the credentials. The swc consumer has its own app with extensionless alias imports and
 * entities that import each other through Relation<T>: SWC builds it to ES modules as the Nest CLI SWC
 * builder does, and tsc only typechecks it with bundler resolution.
 * DATABASE_URL selects an existing database; otherwise a testcontainers Postgres is started and removed afterwards.
 *
 * Flags: --skip-build reuses the current dist, --keep leaves the temporary project in place, --peer-floors installs
 * every peerDependency at the lower bound of its range instead of the repository devDependency versions, and fails
 * unless exactly those versions were installed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONSUMER_ROOT = path.join(ROOT, "test/consumer");
const PACKAGE_NAME = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).name;

const CONSUMERS = [
	{ app: "app", name: "bundler", type: "module" },
	{ app: "app", name: "nodenext", type: "module" },
	{ app: "app", name: "commonjs", type: "commonjs" },
	// The Core and Gameport shape: module commonjs without moduleResolution, which TypeScript 6 resolves as bundler
	{ app: "app", name: "commonjs-default", type: "commonjs" },
	// Native ES modules built by SWC from extensionless @-alias imports, as in Core and Gameport; typechecked by tsc --noEmit
	{ app: "swc", compiler: "swc", name: "swc", type: "module" },
];
const STACK = ["@aws-sdk/client-ssm", "@elsikora/nestjs-aws-parameter-store-config", "@nestjs/common", "@nestjs/config", "@nestjs/core", "@nestjs/typeorm", "@types/node", "pg", "reflect-metadata", "rxjs", "typeorm", "typescript"];
// The SWC toolchain is not a repository devDependency, so the smoke pins it exactly
const SWC_TOOLCHAIN = { "@swc/cli": "0.8.1", "@swc/core": "1.16.18" };
// Both apps import the AWS stub; the swc app imports it without an extension
const SHARED_SOURCE = path.join(CONSUMER_ROOT, "app/src/aws-stub.ts");

const IMPORT_CHECKS = [
	{ arguments_: ["--input-type=module", "--eval", `await import(${JSON.stringify(PACKAGE_NAME)}); console.log(JSON.stringify(process.env.SMOKE_DOTENV ?? null));`], name: "esm import" },
	{ arguments_: ["--input-type=commonjs", "--eval", `require(${JSON.stringify(PACKAGE_NAME)}); console.log(JSON.stringify(process.env.SMOKE_DOTENV ?? null));`], name: "commonjs require" },
];
// An app that leaves a pool or an interval open never exits, so a hang fails the consumer instead of the CI job timeout
const APP_TIMEOUT_MS = 120_000;
const ARGS = new Set(process.argv.slice(2));

/**
 * Returns the lower bound of every peerDependency range, such as 12.3.2 for ">=12.3.2 <13" or 3.0.0-dev.1 for "^3.0.0-dev.1".
 * @param {Record<string, string>} peerDependencies - The repository peerDependencies.
 * @returns {Record<string, string>} Exact versions by package name.
 */
function getPeerFloors(peerDependencies) {
	const floors = {};

	for (const [name, range] of Object.entries(peerDependencies)) {
		const floor = /^(?:>=|\^)(\d+\.\d+\.\d+(?:-[\w.]+)?)(?:\s|$)/.exec(range)?.[1];

		if (!floor) {
			throw new Error(`The peer range of ${name} has no >= or ^ lower bound: ${range}`);
		}

		floors[name] = floor;
	}

	return floors;
}

/**
 * Runs a command with inherited output and fails the smoke when it exits non-zero.
 * @param {string} command - Executable.
 * @param {Array<string>} commandArguments - Arguments.
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, timeout?: number }} options - Working directory, environment and a timeout in milliseconds.
 * @returns {void}
 */
function run(command, commandArguments, options) {
	process.stdout.write(`$ ${command} ${commandArguments.join(" ")}\n`);
	execFileSync(command, commandArguments, { cwd: options.cwd, env: options.env ?? process.env, stdio: "inherit", timeout: options.timeout });
}

/**
 * Builds the temporary project manifest: the tarball plus the stack versions the repository tests with.
 * @param {string} tarball - Absolute tarball path.
 * @returns {string} The manifest JSON.
 */
function createManifest(tarball) {
	const repositoryManifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
	const dependencies = { [PACKAGE_NAME]: `file:${tarball}`, ...SWC_TOOLCHAIN };

	for (const name of STACK) {
		const version = repositoryManifest.devDependencies[name];

		if (!version) {
			throw new Error(`The repository has no devDependency ${name} to pin the consumer stack to`);
		}

		dependencies[name] = version;
	}

	if (ARGS.has("--peer-floors")) {
		Object.assign(dependencies, getPeerFloors(repositoryManifest.peerDependencies));
	}

	return JSON.stringify({ dependencies, name: "typeorm-aws-connector-consumer-smoke", private: true }, undefined, "\t");
}

/**
 * Imports the package in a fresh process next to a .env file and checks that the import prints nothing and loads no variables.
 * @param {string} directory - Directory with the installed package and the .env file.
 * @param {{ arguments_: Array<string>, name: string }} check - The Node.js arguments for one module system.
 * @returns {void}
 */
function checkSilentImport(directory, check) {
	const result = spawnSync(process.execPath, check.arguments_, { cwd: directory, encoding: "utf8" });

	if (result.status !== 0 || result.stderr !== "" || result.stdout !== "null\n") {
		throw new Error(`${check.name} of ${PACKAGE_NAME} is not silent: exit ${String(result.status)}, stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
	}

	process.stdout.write(`PASS ${check.name} prints nothing and loads no .env\n`);
}

/**
 * Returns a database URL: DATABASE_URL when set, otherwise a fresh testcontainers Postgres.
 * @returns {Promise<{ stop: () => Promise<void>, url: string }>} The URL and a stop callback.
 */
async function startDatabase() {
	if (process.env.DATABASE_URL) {
		return { stop: async () => {}, url: process.env.DATABASE_URL };
	}

	const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
	const container = await new PostgreSqlContainer("postgres:17-alpine").start();

	return { stop: async () => void (await container.stop()), url: container.getConnectionUri() };
}

const workDirectory = mkdtempSync(path.join(tmpdir(), "typeorm-aws-connector-consumer-"));
let database;
let failed = false;

try {
	if (!ARGS.has("--skip-build")) {
		run("npm", ["run", "build"], { cwd: ROOT });
	}

	run("npm", ["pack", "--pack-destination", workDirectory], { cwd: ROOT });

	const tarball = path.join(
		workDirectory,
		readdirSync(workDirectory).find((file) => file.endsWith(".tgz")),
	);

	writeFileSync(path.join(workDirectory, "package.json"), createManifest(tarball));
	run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: workDirectory });

	if (ARGS.has("--peer-floors")) {
		const repositoryManifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

		for (const [name, floor] of Object.entries(getPeerFloors(repositoryManifest.peerDependencies))) {
			const installed = JSON.parse(readFileSync(path.join(workDirectory, "node_modules", name, "package.json"), "utf8")).version;

			if (installed !== floor) {
				throw new Error(`${name} is ${installed}, not its floor ${floor}`);
			}

			process.stdout.write(`peer floor ${name}@${installed}\n`);
		}
	}
	writeFileSync(path.join(workDirectory, ".env"), "SMOKE_DOTENV=loaded\n");
	process.stdout.write(`\n=== import side effects (Node.js ${process.version}) ===\n`);

	for (const check of IMPORT_CHECKS) {
		checkSilentImport(workDirectory, check);
	}

	database = await startDatabase();

	for (const consumer of CONSUMERS) {
		const consumerDirectory = path.join(workDirectory, consumer.name);

		cpSync(path.join(CONSUMER_ROOT, consumer.app, "src"), path.join(consumerDirectory, "src"), { recursive: true });
		cpSync(SHARED_SOURCE, path.join(consumerDirectory, "src", path.basename(SHARED_SOURCE)));
		cpSync(path.join(CONSUMER_ROOT, consumer.name, "tsconfig.json"), path.join(consumerDirectory, "tsconfig.json"));
		writeFileSync(path.join(consumerDirectory, "package.json"), JSON.stringify({ name: `consumer-${consumer.name}`, private: true, type: consumer.type }));

		try {
			process.stdout.write(`\n=== consumer ${consumer.name} (${consumer.type}, Node.js ${process.version}) ===\n`);
			run(process.execPath, [path.join(workDirectory, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], { cwd: consumerDirectory });

			if (consumer.compiler === "swc") {
				cpSync(path.join(CONSUMER_ROOT, consumer.name, ".swcrc"), path.join(consumerDirectory, ".swcrc"));
				run(process.execPath, [path.join(workDirectory, "node_modules/@swc/cli/bin/swc.js"), "src", "--out-dir", "dist", "--strip-leading-paths", "--config-file", ".swcrc"], { cwd: consumerDirectory });
			}

			run(process.execPath, ["dist/main.js"], { cwd: consumerDirectory, env: { ...process.env, DATABASE_URL: database.url }, timeout: APP_TIMEOUT_MS });
		} catch {
			failed = true;
			process.stdout.write(`consumer ${consumer.name} FAILED\n`);
		}
	}
} catch (error) {
	failed = true;
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
} finally {
	await database?.stop();

	if (ARGS.has("--keep")) {
		process.stdout.write(`Kept ${workDirectory}\n`);
	} else {
		rmSync(workDirectory, { force: true, recursive: true });
	}
}

process.exitCode = failed ? 1 : 0;
