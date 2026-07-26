import type { TTypeOrmAwsConnectorRotationEvent } from "./event.type";

/**
 * Observes a frozen rotation event without awaiting the returned promise.
 * Listener failures are logged and isolated from rotation and shutdown.
 */
export type TTypeOrmAwsConnectorRotationEventListener = (event: TTypeOrmAwsConnectorRotationEvent) => Promise<void> | void;
