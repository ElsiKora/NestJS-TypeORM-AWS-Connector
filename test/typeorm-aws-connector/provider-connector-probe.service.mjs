import "reflect-metadata";

import { Injectable } from "@nestjs/common";
import { RotatorService, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";

class ProviderConnectorProbeService {
	constructor(connectorService, rotatorService) {
		this.connectorService = connectorService;
		this.rotatorService = rotatorService;
	}
}

Reflect.defineMetadata("design:paramtypes", [TypeOrmAwsConnectorService, RotatorService], ProviderConnectorProbeService);
Injectable()(ProviderConnectorProbeService);

export { ProviderConnectorProbeService };
