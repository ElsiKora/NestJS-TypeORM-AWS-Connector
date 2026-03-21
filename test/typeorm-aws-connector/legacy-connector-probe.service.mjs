import "reflect-metadata";

import { Injectable } from "@nestjs/common";
import { RotatorService, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";

class LegacyConnectorProbeService {
	constructor(connectorService, rotatorService) {
		this.connectorService = connectorService;
		this.rotatorService = rotatorService;
	}
}

Reflect.defineMetadata("design:paramtypes", [TypeOrmAwsConnectorService, RotatorService], LegacyConnectorProbeService);
Injectable()(LegacyConnectorProbeService);

export { LegacyConnectorProbeService };
