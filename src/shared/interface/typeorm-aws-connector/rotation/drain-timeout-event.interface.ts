import type { ETypeOrmAwsConnectorDrainTimeoutPhase, ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";

export interface ITypeOrmAwsConnectorDrainTimeoutEvent {
	readonly activeQueryRunnerCount: number;
	readonly currentGeneration: number;
	readonly phase: ETypeOrmAwsConnectorDrainTimeoutPhase;
	readonly retiringGeneration: null | number;
	readonly shutdownDrainTimeoutMs: number;
	readonly type: ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT;
}
