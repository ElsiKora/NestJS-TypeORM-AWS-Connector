import type { IStructuredLookup } from "./structured-lookup.interface";

export interface ITypeOrmAwsConnectorSsmLookups {
	connectionTimeoutMs?: IStructuredLookup;
	databaseName?: IStructuredLookup;
	host?: IStructuredLookup;
	idleTimeoutMs?: IStructuredLookup;
	poolSize?: IStructuredLookup;
	port?: IStructuredLookup;
	relationLoadStrategy?: IStructuredLookup;
	rotationIntervalMs?: IStructuredLookup;
	rotationIsEnabled?: IStructuredLookup;
	rotationShutdownDrainTimeoutMs?: IStructuredLookup;
	secretId?: IStructuredLookup;
	shouldSynchronize?: IStructuredLookup;
	type?: IStructuredLookup;
}
