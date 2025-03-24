import type { ITypeOrmAwsConnectorConfig } from "@shared/interface/typeorm-aws-connector";

import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { TYPEORM_AWS_CONNECTOR_CONSTANT } from "@shared/constant/typeorm-aws-connector";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/typeorm-aws-connector";
import { DataSource, DataSourceOptions, EntitySubscriberInterface } from "typeorm";

@Injectable()
export class RotatorService implements OnModuleInit {
	private readonly LOGGER: Logger = new Logger(RotatorService.name);

	constructor(
		private readonly dataSource: DataSource,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: ITypeOrmAwsConnectorConfig,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	onModuleInit(): void {
		if (this.databaseConfig.rotation?.isEnabled) {
			const intervalMs: number = this.databaseConfig.rotation.intervalMs ?? TYPEORM_AWS_CONNECTOR_CONSTANT.DATABASE_CONNECTION_ROTATION_INTERVAL;

			const interval: any = setInterval(() => {
				void this.rotateDatabaseConnection();
			}, intervalMs);

			this.schedulerRegistry.addInterval("db-rotation", interval);
			this.LOGGER.log(`DB credentials rotation interval started: ${String(intervalMs)} ms`);
		}
	}

	async rotateDatabaseConnection(): Promise<void> {
		this.LOGGER.log("Launching DB credentials rotation interval...");

		const currentOptions: DataSourceOptions = this.dataSource.options;
		const subscribers: Array<EntitySubscriberInterface> = [...this.dataSource.subscribers];

		if (this.dataSource.isInitialized) {
			await this.dataSource.destroy();
		}

		const newOptions: DataSourceOptions = { ...currentOptions };
		const newDataSource: DataSource = new DataSource(newOptions);
		await newDataSource.initialize();

		for (const subscriber of subscribers) {
			newDataSource.subscribers.push(subscriber);
		}

		this.dataSource.setOptions(newOptions);
		// eslint-disable-next-line @elsikora/typescript/no-unsafe-member-access
		(this.dataSource as any).driver = newDataSource.driver;

		this.LOGGER.log("Rotation completed!");
	}
}
