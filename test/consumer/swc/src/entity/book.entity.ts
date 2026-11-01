import type { Relation } from "typeorm";

import { AuthorEntity } from "@entity/author.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

@Entity("connector_swc_books")
export class BookEntity {
	@JoinColumn({ name: "authorId" })
	@ManyToOne(() => AuthorEntity, (author: AuthorEntity) => author.books, { nullable: false, onDelete: "CASCADE" })
	public author!: Relation<AuthorEntity>;

	@Column({ nullable: false, type: "uuid" })
	public authorId!: string;

	@PrimaryColumn({ nullable: false, type: "uuid" })
	public id!: string;

	@Column({ nullable: false, type: "varchar" })
	public title!: string;
}
