import type { TTypeOrmAwsConnectorRotationEventListener } from "./event-listener.type";

export type TTypeOrmAwsConnectorResolvedRotationConfig = {
	intervalMs: number;
	onEvent: TTypeOrmAwsConnectorRotationEventListener | undefined;
} & (
	| {
			isEnabled: false;
			shutdownDrainTimeoutMs: number | undefined;
	  }
	| {
			isEnabled: true;
			shutdownDrainTimeoutMs: number;
	  }
);
