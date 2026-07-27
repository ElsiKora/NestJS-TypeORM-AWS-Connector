export interface IStructuredLookup {
	application?: string;
	environment?: string;
	instanceName?: string;
	namespace?: string;
	path: Array<string>;
}
