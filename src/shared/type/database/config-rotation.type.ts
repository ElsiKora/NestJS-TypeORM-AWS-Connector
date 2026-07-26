import type { TTypeOrmAwsConnectorRotationEventListener } from "@shared/type/typeorm-aws-connector/rotation";

export type TDatabaseConfigRotation = {
	intervalMs?: number;
	isEnabled?: boolean;
	onEvent?: TTypeOrmAwsConnectorRotationEventListener;
	shutdownDrainTimeoutMs?: number;
};
