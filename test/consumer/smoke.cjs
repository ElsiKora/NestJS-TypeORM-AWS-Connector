"use strict";

const { ETypeOrmAwsConnectorRotationEvent, TypeOrmAwsConnectorModule } = require("@elsikora/nestjs-typeorm-aws-connector");

if (typeof TypeOrmAwsConnectorModule.register !== "function" || ETypeOrmAwsConnectorRotationEvent.GENERATION_RETIRED !== "GENERATION_RETIRED") {
	throw new Error("Connector CommonJS exports are invalid.");
}
