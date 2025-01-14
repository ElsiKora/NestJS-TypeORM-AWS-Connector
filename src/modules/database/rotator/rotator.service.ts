import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DataSource, EntitySubscriberInterface, DataSourceOptions } from "typeorm";
import { IDatabaseConfig } from "@shared/interface/database/config.interface";
import { DATABASE_CONFIG_PROVIDER } from "@shared/provider/database/database.provider";

@Injectable()
export class RotatorService implements OnModuleInit {
	private readonly logger = new Logger(RotatorService.name);

	constructor(
		private readonly dataSource: DataSource,
		@Inject(DATABASE_CONFIG_PROVIDER)
		private readonly databaseConfig: IDatabaseConfig,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	onModuleInit() {
		if (this.dbConfig.rotation?.isEnabled) {
			const intervalMs = this.dbConfig.rotation.intervalMs;

			const interval = setInterval(() => {
				this.rotateDatabaseConnection();
			}, intervalMs);

			this.schedulerRegistry.addInterval("db-rotation", interval);
			this.logger.log(`DB credentials rotation interval started: ${intervalMs} мс`);
		}
	}

	async rotateDatabaseConnection(): Promise<void> {
		this.logger.log("Launching DB credentials rotation interval...");

		const currentOptions = this.dataSource.options;

		if (this.dataSource.isInitialized) {
			await this.dataSource.destroy();
		}

		const newOptions: DataSourceOptions = { ...currentOptions };
		const newDataSource = new DataSource(newOptions);
		await newDataSource.initialize();

		this.dataSource.subscribers.forEach((subscriber: EntitySubscriberInterface) => {
			newDataSource.subscribers.push(subscriber);
		});

		this.dataSource.setOptions(newOptions);
		(this.dataSource as any).driver = newDataSource.driver;

		this.logger.log("Rotation completed!");
	}
}
