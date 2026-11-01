import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { createServer } from "node:http";

export interface IAwsStub {
	close: () => Promise<void>;
	endpoint: string;
	/** Replaces the credentials the secret returns from the next GetSecretValue on, as a Secrets Manager rotation does. */
	rotateSecret: (credentials: IAwsStubCredentials) => void;
	targets: Array<string>;
}

export interface IAwsStubCredentials {
	password: string;
	username: string;
}

export interface IAwsStubDatabase {
	databaseName: string;
	host: string;
	password: string;
	port: number;
	username: string;
}

export const AWS_STUB_PREFIX: string = "/smoke/test";
export const AWS_STUB_SECRET_ID: string = "smoke/database";

/**
 * Splits a postgres:// URL into the fields the stub serves.
 * @param {string} url - Database URL.
 * @returns {IAwsStubDatabase} The database fields.
 */
export function parseDatabaseUrl(url: string): IAwsStubDatabase {
	const parsed: URL = new URL(url);

	return { databaseName: parsed.pathname.slice(1), host: parsed.hostname, password: decodeURIComponent(parsed.password), port: Number(parsed.port || "5432"), username: decodeURIComponent(parsed.username) };
}

/**
 * Starts an HTTP server that answers the AWS JSON protocol calls the connector makes: SSM GetParametersByPath
 * for the parameter store config module and Secrets Manager GetSecretValue for the database credentials.
 * @param {IAwsStubDatabase} database - Database the parameters and the secret point at.
 * @returns {Promise<IAwsStub>} The endpoint, the recorded X-Amz-Target values, a secret rotation callback and a close callback.
 */
export async function startAwsStub(database: IAwsStubDatabase): Promise<IAwsStub> {
	const targets: Array<string> = [];
	let secret: IAwsStubCredentials = { password: database.password, username: database.username };

	const parameters: Record<string, string> = {
		"aws-ecs-fargate/smoke-api/postgres/database-name": database.databaseName,
		"aws-ecs-fargate/smoke-api/postgres/type": "postgres",
		"aws-ecs-fargate/smoke-api/typeorm/rotation/enabled": "true",
		"aws-ecs-fargate/smoke-api/typeorm/rotation/interval-ms": "3600000",
		"aws-ecs-fargate/smoke-api/typeorm/rotation/shutdown-drain-timeout-ms": "5000",
		"aws-ecs-fargate/smoke-api/typeorm/synchronize": "true",
		"aws-rds/aurora-postgres/host": database.host,
		"aws-rds/aurora-postgres/port": String(database.port),
		"aws-secrets-manager/database/secret-id": AWS_STUB_SECRET_ID,
	};

	const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
		let body: string = "";
		request.setEncoding("utf8");
		request.on("data", (chunk: string) => {
			body += chunk;
		});
		request.on("end", () => {
			const target: string = String(request.headers["x-amz-target"]);
			targets.push(target);
			response.setHeader("content-type", "application/x-amz-json-1.1");

			if (target === "AmazonSSM.GetParametersByPath") {
				response.end(JSON.stringify({ Parameters: Object.entries(parameters).map(([name, value]: [string, string]) => ({ Name: `${AWS_STUB_PREFIX}/${name}`, Type: "String", Value: value })) }));

				return;
			}

			if (target === "secretsmanager.GetSecretValue" && (JSON.parse(body) as { SecretId: string }).SecretId === AWS_STUB_SECRET_ID) {
				response.end(JSON.stringify({ Name: AWS_STUB_SECRET_ID, SecretString: JSON.stringify(secret) }));

				return;
			}

			response.statusCode = 400;
			response.end(JSON.stringify({ __type: "UnknownOperationException" }));
		});
	});

	await new Promise<void>((resolve: () => void) => server.listen(0, "127.0.0.1", resolve));
	const { port }: AddressInfo = server.address() as AddressInfo;

	return {
		close: async () => {
			await new Promise<void>((resolve: () => void, reject: (error: Error) => void) =>
				server.close((error?: Error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				}),
			);
		},
		endpoint: `http://127.0.0.1:${String(port)}`,
		rotateSecret: (credentials: IAwsStubCredentials) => {
			secret = { ...credentials };
		},
		targets,
	};
}
