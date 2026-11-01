import type { Relation } from "typeorm";

import { BookEntity } from "@entity/book.entity";
import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";

@Entity("connector_swc_authors")
export class AuthorEntity {
	@OneToMany(() => BookEntity, (book: BookEntity) => book.author)
	public books!: Relation<Array<BookEntity>>;

	@PrimaryColumn({ nullable: false, type: "uuid" })
	public id!: string;

	@Column({ nullable: false, type: "varchar" })
	public name!: string;
}
