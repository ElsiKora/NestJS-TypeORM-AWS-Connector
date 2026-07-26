import type { ETypeOrmAwsConnectorRotationDeferredReason, ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";

/** Describes a deferred rotation attempt that created no replacement generation. */
export interface ITypeOrmAwsConnectorRotationDeferredEvent {
	readonly currentGeneration: number;
	readonly reason: ETypeOrmAwsConnectorRotationDeferredReason;
	readonly retiringGeneration: null | number;
	readonly retiringGenerationActiveQueryRunnerCount: number;
	readonly type: ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED;
}
