import { EDatabaseType } from "@elsikora/nestjs-typeorm-aws-connector";

const CORE_DATABASE_CONFIG = {
	databaseName: "spinwin_core",
	entities: [],
	host: "core-host",
	password: "core-password",
	port: 5432,
	rotation: {
		intervalMs: 60_000,
		isEnabled: false,
	},
	type: EDatabaseType.POSTGRES,
	username: "core-user",
};

export { CORE_DATABASE_CONFIG };
