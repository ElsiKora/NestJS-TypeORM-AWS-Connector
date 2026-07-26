import type { IStructuredLookup } from "./structured-lookup.interface";

export interface ITypeOrmAwsConnectorParameterStoreConfigReader {
	get(properties: IStructuredLookup): null | string;
}
