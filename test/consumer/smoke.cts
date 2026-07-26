import { ETypeOrmAwsConnectorRotationEvent, TypeOrmAwsConnectorModule, type TDatabaseConfigRotation } from "@elsikora/nestjs-typeorm-aws-connector";

const rotation: TDatabaseConfigRotation = {
	isEnabled: false,
};

const dynamicModule = TypeOrmAwsConnectorModule.register({
	entities: [],
	rotation,
});

if (dynamicModule.module !== TypeOrmAwsConnectorModule || ETypeOrmAwsConnectorRotationEvent.DRAIN_TIMEOUT !== "DRAIN_TIMEOUT") {
	throw new Error("Unexpected Connector CommonJS declaration contract.");
}
