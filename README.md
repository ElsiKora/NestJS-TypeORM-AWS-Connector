<p align="center">
  <img src="https://i.ibb.co/rtBYhTH/Untitled-1.png" width="500" alt="project-logo">
</p>
<p align="center">
  <h1 align="center">NestJS TypeORM AWS Connector</h1>
</p>

<p align="center">
	<img src="https://img.shields.io/github/license/ElsiKora/NestJS-TypeORM-AWS-Connector?style=for-the-badge&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/ElsiKora/NestJS-TypeORM-AWS-Connector?style=for-the-badge&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/ElsiKora/NestJS-TypeORM-AWS-Connector?style=for-the-badge&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/ElsiKora/NestJS-TypeORM-AWS-Connector?style=for-the-badge&color=0080ff" alt="repo-language-count">
</p>

<p align="center">
    <em>Developed with the software and tools below.</em>
</p>

<p align="center">
    <a aria-label="ElsiKora logo" href="https://elsikora.com">
        <img src="https://img.shields.io/badge/MADE%20BY%20ElsiKora-212121.svg?style=for-the-badge">
    </a>
	<img src="https://img.shields.io/badge/Prettier-F7B93E.svg?style=for-the-badge&logo=Prettier&logoColor=black" alt="Prettier">
	<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=for-the-badge&logo=ESLint&logoColor=white" alt="ESLint">
	<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white" alt="TypeScript">
	<img src="https://img.shields.io/badge/NestJS-E0234E.svg?style=for-the-badge&logo=NestJS&logoColor=white" alt="NestJS">
	<img src="https://img.shields.io/badge/TypeORM-FE0902.svg?style=for-the-badge&logo=TypeORM&logoColor=white" alt="TypeORM">
</p>

## Overview

NestJS-TypeORM-AWS-Connector is a powerful integration module that provides seamless database connectivity for NestJS applications using TypeORM with AWS infrastructure. It supports automatic connection management, connection pooling, and rotation features specifically designed for AWS environments. The module simplifies database configuration and management while providing robust options for customization and optimization.

## Features

|    | Feature                | Description                                                                                                        |
|----|------------------------|--------------------------------------------------------------------------------------------------------------------|
| 🔄 | **Connection Rotation** | Automatic connection rotation to prevent stale connections and ensure optimal database performance                   |
| 🏊 | **Connection Pooling**  | Configurable connection pool with customizable size and timeout settings                                            |
| ⚡️ | **Performance**        | Optimized database connections with configurable timeouts and idle connection management                            |
| 🔧 | **Easy Configuration** | Flexible configuration options through both static and async module registration                                     |
| 🎯 | **Type Safety**        | Full TypeScript support with strong typing for all configuration options                                            |
| 📊 | **Multiple Databases** | Support for different database types (PostgreSQL, MySQL, etc.) through EDatabaseType enum                           |
| 🔍 | **Verbose Logging**    | Optional verbose mode for detailed logging of database operations                                                    |
| 🔄 | **Auto-Sync Schema**   | Optional automatic schema synchronization with database                                                             |

## Installation

```bash
npm install @elsikora/nestjs-typeorm-aws-connector
```

## Usage

### Async Configuration

```typescript
import { DatabaseModule } from '@elsikora/nestjs-typeorm-aws-connector';
import { EDatabaseType } from '@elsikora/nestjs-typeorm-aws-connector/dist/shared/enum/database/type.enum';

@Module({
  imports: [
    DatabaseModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({
        connectionTimeoutMs: 30_000,
        databaseName: "app",
        entities: [Bank],
        idleTimeoutMs: 30_000,
        isVerbose: true,
        poolSize: 10,
        port: 5432,
        rotation: {
          intervalMs: 5000,
          isEnabled: true,
        },
        shouldSynchronize: true,
        type: EDatabaseType.POSTGRES,
      }),
    }),
  ]
})
export class AppModule {}
```

### Static Configuration

```typescript
import { DatabaseModule } from '@elsikora/nestjs-typeorm-aws-connector';
import { EDatabaseType } from '@elsikora/nestjs-typeorm-aws-connector/dist/shared/enum/database/type.enum';

@Module({
  imports: [
    DatabaseModule.register({
      connectionTimeoutMs: 30_000,
      databaseName: "app",
      entities: [Bank],
      idleTimeoutMs: 30_000,
      isVerbose: true,
      poolSize: 10,
      port: 5432,
      rotation: {
        intervalMs: 5000,
        isEnabled: true,
      },
      shouldSynchronize: true,
      type: EDatabaseType.POSTGRES,
    }),
  ]
})
export class AppModule {}
```

### Integration with TypeORM

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from '@elsikora/nestjs-typeorm-aws-connector';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [DatabaseService],
      useFactory: async (databaseService: DatabaseService) => {
        const options = await databaseService.getTypeOrmOptions();
        return {
          ...options,
        };
      },
    }),
  ]
})
export class AppModule {}
```

## Configuration Options

| Option              | Type      | Required | Default | Description                                                    |
|--------------------|-----------|----------|---------|----------------------------------------------------------------|
| type               | EDatabaseType | Yes      | -       | Database type (POSTGRES, MYSQL, etc.)                          |
| databaseName       | string    | Yes      | -       | Name of the database to connect to                             |
| port               | number    | Yes      | -       | Database port number                                           |
| entities           | Entity[]  | Yes      | -       | Array of entity classes to be loaded                           |
| poolSize           | number    | Yes     | 10      | Maximum number of connections in the pool                      |
| connectionTimeoutMs| number    | Yes     | 30000   | Connection timeout in milliseconds                             |
| idleTimeoutMs      | number    | Yes     | 30000   | Idle connection timeout in milliseconds                        |
| isVerbose          | boolean   | Yes     | false   | Enable verbose logging                                         |
| shouldSynchronize  | boolean   | Yes     | false   | Automatically synchronize database schema                      |
| rotation.isEnabled | boolean   | No       | false   | Enable connection rotation                                     |
| rotation.intervalMs| number    | No       | 5000    | Connection rotation interval in milliseconds                   |

## Database Types

The module supports multiple database types through the `EDatabaseType` enum:

```typescript
enum EDatabaseType {
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
}
```

## Services

### DatabaseService

The `DatabaseService` provides methods for managing database connections and configurations:

- `getTypeOrmOptions()`: Returns TypeORM configuration options
- Other utility methods for connection management

## Error Handling

The module includes built-in error handling for common database connection issues:

- Connection timeout handling
- Pool overflow management
- Rotation failures
- Authentication errors

## Best Practices

1. **Connection Pooling**
    - Set appropriate `poolSize` based on your application's needs
    - Monitor pool usage in production

2. **Connection Rotation**
    - Enable rotation for long-running applications
    - Adjust `rotation.intervalMs` based on your workload

3. **Timeouts**
    - Set reasonable `connectionTimeoutMs` and `idleTimeoutMs`
    - Consider your application's specific requirements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers directly.

---

Made with ♥ by [ElsiKora](https://elsikora.com)
