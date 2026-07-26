export enum ETypeOrmAwsConnectorRotationDeferredReason {
	/** The live TypeORM DataSource has not initialized. */
	DATA_SOURCE_NOT_INITIALIZED = "DATA_SOURCE_NOT_INITIALIZED",

	/** The one retiring generation still owns active query runners. */
	RETIRING_GENERATION_ACTIVE = "RETIRING_GENERATION_ACTIVE",

	/** The retiring generation could not close and still blocks promotion. */
	RETIRING_GENERATION_CLOSE_FAILED = "RETIRING_GENERATION_CLOSE_FAILED",

	/** Another rotation attempt already owns the replacement pipeline. */
	ROTATION_IN_PROGRESS = "ROTATION_IN_PROGRESS",

	/** Shutdown stopped new rotation admission. */
	SHUTDOWN_IN_PROGRESS = "SHUTDOWN_IN_PROGRESS",
}
