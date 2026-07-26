import type { DataSource } from "typeorm";

export type TQueryRunnerMode = Parameters<DataSource["createQueryRunner"]>[0];
