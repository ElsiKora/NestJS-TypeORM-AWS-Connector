import type { TTypeOrmAwsConnectorRotationEventListener } from "@shared/type/typeorm-aws-connector/rotation";

export type TDatabaseConfigRotation = {
	/** Rotation interval in milliseconds. Defaults to one hour and must be a positive integer. */
	intervalMs?: number;

	/** Enables periodic credential rotation. Defaults to false. */
	isEnabled?: boolean;

	/** Optional non-blocking observer for structured rotation lifecycle events. */
	onEvent?: TTypeOrmAwsConnectorRotationEventListener;

	/** Required positive integer when rotation is enabled, unless resolved from Parameter Store. */
	shutdownDrainTimeoutMs?: number;
};
