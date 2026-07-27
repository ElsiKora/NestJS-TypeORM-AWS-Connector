import type { DataSource, DataSourceOptions } from "typeorm";

export type TMutableDriver = {
	connection: DataSource;
	options: DataSourceOptions;
} & DataSource["driver"];
