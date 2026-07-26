import type { ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";

/** Describes a database generation that closed successfully. */
export interface ITypeOrmAwsConnectorGenerationRetiredEvent {
	readonly currentGeneration: number;
	readonly generation: number;
	readonly isForced: boolean;
	readonly type: ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED;
}
