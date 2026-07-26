import type { ETypeOrmAwsConnectorRotationEvent } from "@shared/enum";

export interface ITypeOrmAwsConnectorGenerationRetiredEvent {
	readonly currentGeneration: number;
	readonly generation: number;
	readonly isForced: boolean;
	readonly type: ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED;
}
