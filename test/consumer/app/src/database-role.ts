import type { IAwsStubCredentials, IAwsStubDatabase } from "./aws-stub.js";

import { randomBytes } from "node:crypto";

import { DataSource } from "typeorm";

/**
 * Creates a login role with data access to every table, as a credential rotation would hand out.
 * @param {DataSource} dataSource - Data source connected as a role that may create roles.
 * @returns {Promise<IAwsStubCredentials>} The new role and its password.
 */
export async function createDatabaseRole(dataSource: DataSource): Promise<IAwsStubCredentials> {
	// Hex only, so the values are safe inside the DDL literals
	const suffix: string = randomBytes(6).toString("hex");
	const credentials: IAwsStubCredentials = { password: `rotated-${suffix}`, username: `connector_rotated_${suffix}` };

	await dataSource.query(`CREATE ROLE "${credentials.username}" LOGIN PASSWORD '${credentials.password}'`);
	await dataSource.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${credentials.username}"`);

	return credentials;
}

/**
 * Drops a role created by createDatabaseRole through a separate connection with the original credentials.
 * @param {IAwsStubDatabase} database - Database and its original credentials.
 * @param {string} username - Role to drop.
 * @returns {Promise<void>}
 */
export async function dropDatabaseRole(database: IAwsStubDatabase, username: string): Promise<void> {
	const administrator: DataSource = new DataSource({ database: database.databaseName, host: database.host, password: database.password, port: database.port, type: "postgres", username: database.username });

	await administrator.initialize();

	try {
		await administrator.query(`DROP OWNED BY "${username}"`);
		await administrator.query(`DROP ROLE "${username}"`);
	} finally {
		await administrator.destroy();
	}
}

/**
 * Returns the role the data source's pool connects as.
 * @param {DataSource} dataSource - Data source to ask.
 * @returns {Promise<string>} The current_user of a pooled connection.
 */
export async function readCurrentUser(dataSource: DataSource): Promise<string> {
	const rows: Array<{ name: string }> = await dataSource.query<Array<{ name: string }>>("SELECT current_user AS name");

	return rows[0]?.name ?? "";
}
