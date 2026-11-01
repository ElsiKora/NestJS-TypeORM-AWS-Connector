import type { INestApplicationContext } from "@nestjs/common";
import type { Repository } from "typeorm";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { RotatorService } from "@elsikora/nestjs-typeorm-aws-connector";
import { AuthorEntity } from "@entity/author.entity";
import { BookEntity } from "@entity/book.entity";
import { NestFactory } from "@nestjs/core";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

import { AppModule } from "./app.module";
import { type IAwsStub, type IAwsStubCredentials, type IAwsStubDatabase, parseDatabaseUrl, startAwsStub } from "./aws-stub";
import { createDatabaseRole, dropDatabaseRole, readCurrentUser } from "./database-role";

import "reflect-metadata";

/**
 * Boots an application built by SWC to native ES modules, as with the Nest CLI SWC builder, with entities that
 * import each other through Relation<T>, loads both sides of the relation and rotates the credentials to a new database role.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
	const database: IAwsStubDatabase = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
	const stub: IAwsStub = await startAwsStub(database);

	process.env.AWS_ACCESS_KEY_ID = "smoke";
	process.env.AWS_ENDPOINT_URL_SECRETS_MANAGER = stub.endpoint;
	process.env.AWS_MAX_ATTEMPTS = "1";
	process.env.AWS_REGION = "us-east-1";
	process.env.AWS_SECRET_ACCESS_KEY = "smoke";

	let app: INestApplicationContext | undefined;
	let rotated: IAwsStubCredentials | undefined;

	try {
		app = await NestFactory.createApplicationContext(AppModule.register(stub.endpoint), { abortOnError: false, logger: false });
		const dataSource: DataSource = app.get(DataSource);
		const authors: Repository<AuthorEntity> = app.get(getRepositoryToken(AuthorEntity));
		const books: Repository<BookEntity> = app.get(getRepositoryToken(BookEntity));
		const authorId: string = randomUUID();
		const bookId: string = randomUUID();

		await authors.save({ id: authorId, name: "Ann" });
		await books.save({ authorId, id: bookId, title: "Cycle" });
		const book: BookEntity = await books.findOneOrFail({ relations: { author: true }, where: { id: bookId } });

		assert.deepEqual({ id: book.author.id, name: book.author.name }, { id: authorId, name: "Ann" });
		process.stdout.write("PASS swc esm: ManyToOne side of a Relation<T> cycle\n");

		rotated = await createDatabaseRole(dataSource);
		stub.rotateSecret(rotated);
		await app.get(RotatorService).rotateDatabaseConnection();
		assert.equal(await readCurrentUser(dataSource), rotated.username);
		// Every TypeORM 1 driver class has dataSource, the Driver interface does not declare it
		assert.equal((dataSource.driver as unknown as { dataSource: DataSource }).dataSource, dataSource);
		const author: AuthorEntity = await authors.findOneOrFail({ relations: { books: true }, where: { id: authorId } });

		assert.deepEqual(
			author.books.map((loadedBook: BookEntity) => ({ authorId: loadedBook.authorId, id: loadedBook.id, title: loadedBook.title })),
			[{ authorId, id: bookId, title: "Cycle" }],
		);
		process.stdout.write("PASS swc esm: OneToMany side after a credential rotation\n");

		await authors.delete({ id: authorId });
	} finally {
		// A failed assertion must not leave the pool and the rotation interval holding the process open
		await app?.close();
		await stub.close();

		if (rotated) {
			await dropDatabaseRole(database, rotated.username);
		}
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
	process.exitCode = 1;
});
