import { EDatabaseType } from "@elsikora/nestjs-typeorm-aws-connector";

const PROVIDER_DATABASE_CONFIG = {
	databaseName: "spinwin_quickspin",
	entities: [],
	host: "provider-host",
	password: "provider-password",
	port: 5433,
	rotation: {
		intervalMs: 60_000,
		isEnabled: false,
	},
	type: EDatabaseType.POSTGRES,
	username: "provider-user",
};

export { PROVIDER_DATABASE_CONFIG };
