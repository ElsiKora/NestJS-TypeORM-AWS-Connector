import { ETypeOrmAwsConnectorRotationDeferredReason, ETypeOrmAwsConnectorRotationEvent, TypeOrmAwsConnectorModule, type TDatabaseConfigRotation, type TTypeOrmAwsConnectorRotationEvent } from "@elsikora/nestjs-typeorm-aws-connector";

const onEvent = (event: TTypeOrmAwsConnectorRotationEvent): void => {
	if (event.type === ETypeOrmAwsConnectorRotationEvent.ROTATION_DEFERRED && event.reason === ETypeOrmAwsConnectorRotationDeferredReason.RETIRING_GENERATION_ACTIVE) {
		void event.retiringGeneration;
	}
};

const rotation: TDatabaseConfigRotation = {
	isEnabled: true,
	onEvent,
	shutdownDrainTimeoutMs: 15_000,
};

const dynamicModule = TypeOrmAwsConnectorModule.register({
	entities: [],
	rotation,
});

if (dynamicModule.module !== TypeOrmAwsConnectorModule) {
	throw new Error("Unexpected Connector dynamic module export.");
}
