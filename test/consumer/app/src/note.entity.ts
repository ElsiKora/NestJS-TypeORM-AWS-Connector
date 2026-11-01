import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("connector_smoke_notes")
export class NoteEntity {
	@PrimaryColumn({ nullable: false, type: "uuid" })
	public id!: string;

	@Column({ nullable: false, type: "varchar" })
	public text!: string;
}
