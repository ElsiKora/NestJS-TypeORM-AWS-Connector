import type { TTypeOrmAwsConnectorRotationEvent } from "./event.type";

export type TTypeOrmAwsConnectorRotationEventListener = (event: TTypeOrmAwsConnectorRotationEvent) => Promise<void> | void;
