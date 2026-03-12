import type { IStructuredLookup } from "./structured-lookup.interface";

export interface ITypeOrmAwsConnectorSsmLookups {
	connectionTimeoutMs?: IStructuredLookup;
	databaseName?: IStructuredLookup;
	host?: IStructuredLookup;
	idleTimeoutMs?: IStructuredLookup;
	isVerbose?: IStructuredLookup;
	poolSize?: IStructuredLookup;
	port?: IStructuredLookup;
	relationLoadStrategy?: IStructuredLookup;
	rotationIntervalMs?: IStructuredLookup;
	rotationIsEnabled?: IStructuredLookup;
	secretId?: IStructuredLookup;
	shouldSynchronize?: IStructuredLookup;
	type?: IStructuredLookup;
}
