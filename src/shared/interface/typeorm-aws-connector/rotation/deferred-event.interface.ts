import type { ETypeOrmAwsConnectorRotationDeferredReason, ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";

export interface ITypeOrmAwsConnectorRotationDeferredEvent {
	readonly currentGeneration: number;
	readonly reason: ETypeOrmAwsConnectorRotationDeferredReason;
	readonly retiringGeneration: null | number;
	readonly retiringGenerationActiveQueryRunnerCount: number;
	readonly type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED;
}
