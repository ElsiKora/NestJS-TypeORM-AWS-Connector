# [3.0.0](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v2.0.1...v3.0.0) (2026-11-03)

### Bug Fixes

- **deps:** require the stable parameter store config 3 ([47e3bde](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/47e3bde0d525cb42de1212e05389c144f20fe141))

### Build System

- **deps:** move to nestjs 12, typeorm 1 and the latest tooling majors ([3fb1158](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/3fb1158104b2c4add8fe22edeac1ceabc1fe528a))
- **package:** publish an esm-only build with extension-qualified declarations ([f855984](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/f8559848f3ed95e8bf47df023af50adddaed0fe9))

### BREAKING CHANGES

- **package:** the package is ES modules only. dist/esm, dist/cjs and the require export condition are gone. A commonjs application keeps require() and loads the package through node's require(esm), and deep imports into dist no longer resolve.
- **deps:** the peer ranges are now @nestjs/common and @nestjs/core

> =12.3.2 <13, @nestjs/config >=12.0.1 <13, typeorm >=1.1.2 <2, @elsikora/nestjs-aws-parameter-store-config ^3.0.0-dev.1 and @aws-sdk/client-ssm >=3.535.0 <4, and engines.node is ^22.13.0 || >=24.11.0. The application installs the parameter store config package and @nestjs/config itself. Applications on nestjs 11, typeorm 0.3 or node 20 stay on 2.x.

## [2.0.1](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v2.0.0...v2.0.1) (2026-09-01)

### Bug Fixes

- **logging:** hard-disable unsafe database logs ([4997b40](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/4997b4026e9d93daa3c895b456b6eb5010f26a2f))

# [2.0.0](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.4.1...v2.0.0) (2026-07-27)

### Bug Fixes

- **ci:** install without an ignored lockfile ([022fd70](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/022fd7022401331cb9e5c0fd281f5a4f4bb81844))
- **packaging:** publish portable declarations ([5c0be33](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/5c0be330cea85b298f1aaad3110675950f51721d))

### Features

- **rotation:** bound database credential lifecycle ([cd67021](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/cd67021cbf92f901d339887664d286aae6e7a31d))

### BREAKING CHANGES

- **rotation:** Enabled rotation now requires a positive rotation.shutdownDrainTimeoutMs value. Shutdown may reject when generations cannot drain or close within the configured timeout.

## [1.4.1](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.4.0...v1.4.1) (2026-03-24)

### Bug Fixes

- **typeorm-aws-connector:** stage credential rotation reconnect ([8fee2ff](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/8fee2ff9a03661cab6c6a525e351e1d29e76f58a))

# [1.4.0](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.3.4...v1.4.0) (2026-03-21)

### Features

- **typeorm-aws-connector:** add support for multiple database modules with datasourcetoken option ([cfc28bb](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/cfc28bbb62349662bdc92ea751a46b741f74dbd9))

## [1.3.4](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.3.3...v1.3.4) (2026-03-13)

### Bug Fixes

- **typeorm-aws-connector:** add explicit inject decorator for datasource dependency ([7077270](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/7077270e97fdddc1738051b83852d439f702a2dd))

## [1.3.3](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.3.2...v1.3.3) (2026-03-12)

## [1.3.2](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.3.1...v1.3.2) (2026-03-12)

## [1.3.1](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.3.0...v1.3.1) (2025-03-24)

# [1.3.0](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/compare/v1.2.2...v1.3.0) (2025-03-24)

### Features

- **build:** implement dual esm/cjs module format with improved db rotation ([cfcdf55](https://github.com/ElsiKora/NestJS-TypeORM-AWS-Connector/commit/cfcdf5596ae5be2170babfcf4b34857825dbcfbe))
