<p align="center">
  <img src="https://6jft62zmy9nx2oea.public.blob.vercel-storage.com/nestjs-typeorm-aws-connector-moPeh5TktoUIqqecoEMyixlLWpCIfL.png" width="500" alt="project-logo">
</p>

<h1 align="center">NestJS-TypeORM-AWS-Connector 🔌</h1>
<p align="center"><em>Seamlessly connect your NestJS applications with AWS Parameter Store and TypeORM</em></p>

<p align="center">
    <a aria-label="ElsiKora logo" href="https://elsikora.com">
  <img src="https://img.shields.io/badge/MADE%20BY%20ElsiKora-333333.svg?style=for-the-badge" alt="ElsiKora">
</a> <img src="https://img.shields.io/badge/npm-blue.svg?style=for-the-badge&logo=npm&logoColor=white" alt="npm"> <img src="https://img.shields.io/badge/nestjs-E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white" alt="nestjs"> <img src="https://img.shields.io/badge/typescript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="typescript"> <img src="https://img.shields.io/badge/aws-232F3E.svg?style=for-the-badge&logo=amazonaws&logoColor=white" alt="aws"> <img src="https://img.shields.io/badge/typeorm-orange.svg?style=for-the-badge&logo=typeorm&logoColor=white" alt="typeorm"> <img src="https://img.shields.io/badge/license-MIT-yellow.svg?style=for-the-badge&logo=license&logoColor=white" alt="license-MIT">
</p>


## 📚 Table of Contents
- [Description](#-description)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Roadmap](#-roadmap)
- [FAQ](#-faq)
- [License](#-license)


## 📖 Description
NestJS-TypeORM-AWS-Connector provides a robust solution for NestJS applications requiring secure database connections with credentials stored in AWS. This connector bridges the gap between your TypeORM-powered NestJS application and AWS services like Secrets Manager and Parameter Store, enabling secure credential management and automated rotation. Perfect for cloud-native applications, microservices, and enterprise systems where security and reliability are paramount. The connector supports multiple database types, connection pooling optimization, and eliminates hardcoded credentials in your codebase, significantly enhancing your application's security posture.

## 🚀 Features
- ✨ **Secure credential management with AWS Secrets Manager integration**
- ✨ **Automatic database connection rotation to mitigate credential leaks**
- ✨ **Configurable connection pooling for optimal database performance**
- ✨ **Support for multiple database types (MySQL, PostgreSQL)**
- ✨ **Customizable relation load strategies for performance optimization**
- ✨ **Failure recovery mechanism for maintaining database connectivity**
- ✨ **Easy integration with NestJS application configurations**
- ✨ **Support for both synchronous and asynchronous module registration**
- ✨ **Extensive logging for debugging and monitoring**
- ✨ **Zero configuration option with sensible defaults**

## 🛠 Installation
```bash
# Using npm
npm install @elsikora/nestjs-typeorm-aws-connector

# Using yarn
yarn add @elsikora/nestjs-typeorm-aws-connector

# Using pnpm
pnpm add @elsikora/nestjs-typeorm-aws-connector


### Prerequisites

- NestJS application
- AWS credentials configured
- TypeORM integrated with your NestJS app
```

## ⚠️ Important Prerequisites

This module requires `@elsikora/nestjs-aws-parameter-store-config` to function properly. Before using this module, please:

1. Install and configure `@elsikora/nestjs-aws-parameter-store-config`
2. Familiarize yourself with its documentation and setup
3. Ensure it's properly configured in your NestJS application

Example of both modules working together:

```typescript
@Module({
	imports: [
		// First, configure Parameter Store
		ParameterStoreConfigModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				application: config.get<string>("APPLICATION"),
				config: {
					region: config.get<string>("AWS_REGION"),
				},
				decryptParameters: true,
				environment: config.get<string>("ENVIRONMENT"),
				recursiveLoading: true,
			}),
		}),
		// Then, configure Database module
		TypeOrmAwsConnectorModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async () => ({
				connectionTimeoutMs: 30_000,
				databaseName: "app",
				entities: [Bank],
				// ... other options
			}),
		}),
	],
})
export class AppModule {}
```

For more information about the Parameter Store configuration, please refer to the [@elsikora/nestjs-aws-parameter-store-config documentation](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config).

## 💡 Usage
## Basic Usage

First, import the module in your NestJS application's main module:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmAwsConnectorModule } from '@elsikora/nestjs-typeorm-aws-connector';
import { EDatabaseType } from '@elsikora/nestjs-typeorm-aws-connector';
import { UserEntity } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmAwsConnectorModule.register({
      type: EDatabaseType.POSTGRES,
      databaseName: 'my_database',
      port: 5432,
      entities: [UserEntity],
      // Optionally enable credential rotation
      rotation: {
        isEnabled: true,
        intervalMs: 3600000, // 1 hour
      }
    }),
  ],
})
export class AppModule {}
```

## Asynchronous Configuration

If you need to load configuration asynchronously, use the `registerAsync` method:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmAwsConnectorModule } from '@elsikora/nestjs-typeorm-aws-connector';
import { EDatabaseType } from '@elsikora/nestjs-typeorm-aws-connector';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmAwsConnectorModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: EDatabaseType.MYSQL,
        databaseName: configService.get('DB_NAME'),
        port: configService.get('DB_PORT'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        rotation: {
          isEnabled: configService.get('DB_ROTATION_ENABLED') === 'true',
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## Using TypeOrmAwsConnectorService

Inject the service to manually retrieve database connection options:

```typescript
import { Injectable } from '@nestjs/common';
import { TypeOrmAwsConnectorService } from '@elsikora/nestjs-typeorm-aws-connector';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
export class DatabaseService {
  private dataSource: DataSource;

  constructor(private readonly connectorService: TypeOrmAwsConnectorService) {}

  async initializeConnection() {
    const options: DataSourceOptions = await this.connectorService.getTypeOrmOptions();
    this.dataSource = new DataSource(options);
    await this.dataSource.initialize();
    return this.dataSource;
  }
}
```

## AWS Parameter Store and Secrets Manager Configuration

The connector expects your AWS environment to be properly configured:

```typescript
// Simplified example of AWS setup requirements
// In your AWS Parameter Store:
// /myapp/database-credentials-secret-id -> 'db-credentials-secret-id'
// /myapp/host -> 'your-database-hostname'

// In AWS Secrets Manager (with ID 'db-credentials-secret-id'):
// {
//   "username": "dbuser",
//   "password": "dbpassword"
// }

// Your NestJS module configuration
TypeOrmAwsConnectorModule.register({
  type: EDatabaseType.POSTGRES,
  databaseName: 'myapp_db',
  port: 5432,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  secretID: {
    path: ['myapp', 'database-credentials-secret-id'],
    service: EService.AWS_SECRETS_MANAGER
  },
  host: {
    path: ['myapp', 'host'],
    service: EService.AWS_RDS
  }
})
```

## Connection Rotation

Enable automatic credential rotation for enhanced security:

```typescript
TypeOrmAwsConnectorModule.register({
  // Basic config...
  type: EDatabaseType.POSTGRES,
  databaseName: 'myapp_db',
  port: 5432,
  entities: [UserEntity],
  
  // Rotation config
  rotation: {
    isEnabled: true,
    intervalMs: 1800000 // Rotate every 30 minutes
  },
  
  // Advanced connection pool settings
  poolSize: 20,
  connectionTimeoutMs: 60000,
  idleTimeoutMs: 30000
})
```

## Advanced Configuration Options

You can fine-tune the connector with various options:

```typescript
import { ERelationLoadStrategy } from '@elsikora/nestjs-typeorm-aws-connector';

TypeOrmAwsConnectorModule.register({
  // Basic config...
  type: EDatabaseType.POSTGRES,
  databaseName: 'myapp_db',
  port: 5432,
  entities: [UserEntity],
  
  // Performance settings
  poolSize: 15,
  connectionTimeoutMs: 30000,
  idleTimeoutMs: 60000,
  
  // Database behavior
  shouldSynchronize: false,
  isVerbose: true,
  relationLoadStrategy: ERelationLoadStrategy.QUERY,
  
  // AWS configuration
  secretID: {
    path: ['my-app', 'db-secret-id'],
    service: EService.AWS_SECRETS_MANAGER
  },
  host: {
    path: ['my-app', 'db-host'],
    service: EService.AWS_RDS
  }
})
```

## 🛣 Roadmap
| Task / Feature | Status |
|---------------|--------|
| Core module implementation | ✅ Done |
| AWS Secrets Manager integration | ✅ Done |
| TypeORM configuration provider | ✅ Done |
| Connection rotation service | ✅ Done |
| Credential rotation automation | ✅ Done |
| PostgreSQL database support | ✅ Done |
| MySQL database support | ✅ Done |
| Failover recovery mechanism | ✅ Done |
| Customizable rotation intervals | ✅ Done |
| Connection pooling optimization | ✅ Done |
| Multiple AWS regions support | 🚧 In Progress |
| Automatic Schema Migration | 🚧 In Progress |
| Connection encryption options | 🚧 In Progress |
| MongoDB support | 🚧 In Progress |
| Connection health metrics | 🚧 In Progress |
| Multi-database connection management | 🚧 In Progress |
| Docker integration examples | 🚧 In Progress |
| AWS Lambda optimized configuration | 🚧 In Progress |

## ❓ FAQ
### Frequently Asked Questions

#### Q: Does this library work with AWS Fargate and ECS?
A: Yes, this library is designed to work seamlessly with AWS container services like Fargate and ECS. Ensure your task roles have proper permissions to access Parameter Store and Secrets Manager.

#### Q: How does credential rotation work?
A: When rotation is enabled, the connector periodically fetches fresh credentials from AWS Secrets Manager without disrupting existing connections. It creates a new connection pool with updated credentials, verifies it works correctly, and then seamlessly replaces the old connection.

#### Q: What happens if AWS services are temporarily unavailable?
A: The connector includes a failover mechanism that retries connection attempts and maintains the current connection until AWS services become available again. After multiple failures, it will attempt an emergency recovery process.

#### Q: Can I use this with non-AWS hosted databases?
A: Yes, you can use this connector with any database as long as the connection credentials are stored in AWS Secrets Manager and Parameter Store. The actual database can be hosted anywhere.

#### Q: Does this support custom TypeORM entities and migrations?
A: Absolutely. The connector seamlessly integrates with your existing TypeORM entities and migration configurations.

#### Q: What permissions do I need in AWS?
A: Your AWS role needs read permissions for Parameter Store and Secrets Manager. Specifically, you need `ssm:GetParameter` and `secretsmanager:GetSecretValue` permissions.

#### Q: Can I customize the logger?
A: The connector uses NestJS's built-in logger by default, which you can customize through your NestJS application configuration.

## 🔒 License
This project is licensed under **MIT License

Copyright (c) 2025 ElsiKora

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.**.
