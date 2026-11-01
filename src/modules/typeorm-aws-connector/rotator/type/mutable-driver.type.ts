import type { DataSource, DataSourceOptions } from "typeorm";

export type TMutableDriver = {
	dataSource: DataSource;
	options: DataSourceOptions;
} & DataSource["driver"];
