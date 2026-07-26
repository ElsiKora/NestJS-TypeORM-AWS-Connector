export enum ETypeOrmAwsConnectorDrainTimeoutPhase {
	/** Active query runners or an in-flight rotation did not settle. */
	DRAIN = "DRAIN",

	/** Best-effort generation close did not settle. */
	GENERATION_CLOSE = "GENERATION_CLOSE",
}
