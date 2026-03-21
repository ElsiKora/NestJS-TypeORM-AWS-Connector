import "reflect-metadata";

import { Injectable } from "@nestjs/common";
import { RotatorService, TypeOrmAwsConnectorService } from "@elsikora/nestjs-typeorm-aws-connector";

class CoreConnectorProbeService {
	constructor(connectorService, rotatorService) {
		this.connectorService = connectorService;
		this.rotatorService = rotatorService;
	}
}

Reflect.defineMetadata("design:paramtypes", [TypeOrmAwsConnectorService, RotatorService], CoreConnectorProbeService);
Injectable()(CoreConnectorProbeService);

export { CoreConnectorProbeService };
