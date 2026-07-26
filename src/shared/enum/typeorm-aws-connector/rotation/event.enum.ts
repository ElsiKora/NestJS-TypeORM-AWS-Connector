export enum ETypeOrmAwsConnectorRotationEvent {
	/** Active work or generation close exceeded its bounded shutdown phase. */
	DRAIN_TIMEOUT = "DRAIN_TIMEOUT",

	/** A current or retiring generation closed successfully. */
	GENERATION_RETIRED = "GENERATION_RETIRED",

	/** A rotation attempt was skipped without creating a replacement. */
	ROTATION_DEFERRED = "ROTATION_DEFERRED",
}
