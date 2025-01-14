<p align="center">
  <img src="https://i.ibb.co/10GfSy3/Untitled-2.png" width="100" alt="project-logo">
</p>
<p align="center">
    <h1 align="center">NestJS AWS Parameter Store Config</h1>
</p>
<p align="center">
	<img src="https://img.shields.io/github/license/ElsiKora/NestJS-AWS-Parameter-Store-Config?style=for-the-badge&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/ElsiKora/NestJS-AWS-Parameter-Store-Config?style=for-the-badge&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/ElsiKora/NestJS-AWS-Parameter-Store-Config?style=for-the-badge&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/ElsiKora/NestJS-AWS-Parameter-Store-Config?style=for-the-badge&color=0080ff" alt="repo-language-count">
<p>
<p align="center">
		<em>Developed with the software and tools below.</em>
</p>
<p align="center">
    <a aria-label="ElsiKora logo" href="https://elsikora.com">
        <img src="https://img.shields.io/badge/MADE%20BY%20ElsiKora-212121.svg?style=for-the-badge">
    </a>
	<img src="https://img.shields.io/badge/Prettier-F7B93E.svg?style=for-the-badge&logo=Prettier&logoColor=black" alt="Prettier">
	<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=for-the-badge&logo=ESLint&logoColor=white" alt="ESLint">
	<img src="https://img.shields.io/badge/tsnode-3178C6.svg?style=for-the-badge&logo=ts-node&logoColor=white" alt="tsnode">
	<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white" alt="TypeScript">
	<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF.svg?style=for-the-badge&logo=GitHub-Actions&logoColor=white" alt="GitHub%20Actions">
	<img src="https://img.shields.io/badge/JSON-000000.svg?style=for-the-badge&logo=JSON&logoColor=white" alt="JSON">
</p>

<br><!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary><br>

- [ Overview](#-overview)
- [ Features](#-features)
- [ Repository Structure](#-repository-structure)
- [ Modules](#-modules)
- [ Getting Started](#-getting-started)
  - [ Installation](#-installation)
  - [ Usage](#-usage)
  - [ Tests](#-tests)
- [ Project Roadmap](#-project-roadmap)
- [ Contributing](#-contributing)
- [ License](#-license)
- [ Acknowledgments](#-acknowledgments)
</details>
<hr>

##  Overview

The NestJS-AWS-Parameter-Store-Config project seamlessly integrates AWS Parameter Store with NestJS applications, enhancing configuration management through secure, centralized access to settings. It simplifies the retrieval and management of configurations, supporting both synchronous and asynchronous setups with utility functions for type-safe parameter access. This setup ensures efficient, flexible handling of application settings, leveraging AWS for sensitive parameter management. By automating deployment workflows, ensuring consistent coding practices, and providing dynamic module registration, the project significantly streamlines development processes, making it an indispensable tool for developers aiming to leverage AWS Parameter Store in their NestJS projects.

---

##  Features

|    | Feature            | Description                                                                                                                                                         |
|----|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ⚙️  | **Architecture**   | Leverages NestJS for structuring the integration with AWS Parameter Store, ensuring scalable, maintainable code through modularization and dependency injection.    |
| 🔩 | **Code Quality**   | Adheres to best practices with comprehensive linting tools (`eslint`, `prettier`) and custom configurations, promoting clean and consistent code style.             |
| 📄 | **Documentation**  | Includes detailed comments within code and thorough `README.md`, but lacks broader documentation on usage examples and setup instructions.                         |
| 🔌 | **Integrations**   | Primarily integrates with AWS Parameter Store via `@aws-sdk/client-ssm` for config management, leveraging NestJS for application scaffolding.                      |
| 🧩 | **Modularity**     | Highly modular structure, separating AWS SSM integration, config management, and application logic, enhancing readability and reusability.                          |
| 🧪 | **Testing**        | Absence of dedicated testing frameworks or tools in the project dependencies suggests a potential area for improvement in test coverage and quality assurance.      |
| ⚡️ | **Performance**    | Efficient handling of configuration through AWS SSM with options for recursive fetching and decryption, though specific performance metrics are not provided.       |
| 🛡️ | **Security**       | Utilizes AWS SSM for secure storage and retrieval of parameters, but detailed security practices within the codebase are not explicitly documented.                  |
| 📦 | **Dependencies**   | Relies on NestJS ecosystem (`@nestjs/common`, `@nestjs/core`, etc.), AWS SDK for JavaScript v3 (`@aws-sdk/client-ssm`), and several ESLint plugins for code quality.|
| 🚀 | **Scalability**    | Designed for scalability, leveraging NestJS framework's capabilities and AWS Parameter Store's managed service for handling configuration at scale.                 |
```

---

##  Repository Structure

```sh
└── NestJS-AWS-Parameter-Store-Config/
    ├── .github
    │   └── workflows
    ├── CHANGELOG.md
    ├── LICENSE
    ├── README.md
    ├── nest-cli.json
    ├── package.json
    ├── src
    │   ├── constant.ts
    │   ├── index.ts
    │   ├── modules
    │   └── shared
    ├── tsconfig.json
    └── tsconfig.test.json
```

---

##  Modules

<details closed><summary>.</summary>

| File                                                                                                                   | Summary                                                                                                                                                                                                                                                                                                                                     |
| ---                                                                                                                    | ---                                                                                                                                                                                                                                                                                                                                         |
| [nest-cli.json](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/nest-cli.json)           | Configures the NestJS project to use specific schematics for code generation and sets the root directory for the source code, ensuring a streamlined development workflow and consistency across the project within the NestJS-AWS-Parameter-Store-Config repositorys architecture.                                                         |
| [tsconfig.test.json](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/tsconfig.test.json) | Configures TypeScript for testing by extending the main TypeScript configuration. It excludes certain directories from the testing context, ensuring tests are executed efficiently and only on relevant source files, aligning with the repositorys commitment to maintainable and scalable practices within a NestJS environment.         |
| [package.json](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/package.json)             | Defines the configuration for a NestJS module integrating AWS Parameter Store for application settings, specifying metadata such as version, author, and license. It lists dependencies for development, peer dependencies for compatibility with NestJS versions, and scripts for tasks like building, linting, and releasing the package. |
| [tsconfig.json](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/tsconfig.json)           | Defines TypeScript compilation settings for the NestJS-AWS-Parameter-Store-Config project, emphasizing compatibility and code organization. It specifies module system, output directory, and custom path aliases to streamline development and build processes within the repositorys architecture.                                        |

</details>

<details closed><summary>.github.workflows</summary>

| File                                                                                                                       | Summary                                                                                                                                                                                                                                                                                                                           |
| ---                                                                                                                        | ---                                                                                                                                                                                                                                                                                                                               |
| [release.yml](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/.github/workflows/release.yml) | Automates the deployment process and versioning workflow for the NestJS-AWS-Parameter-Store-Config repository, ensuring consistent and error-free releases. It integrates directly with GitHub Actions, streamlining the release cycle from code changes to publishing, thereby enhancing the repositorys operational efficiency. |

</details>

<details closed><summary>src</summary>

| File                                                                                                           | Summary                                                                                                                                                                                                                                                                                                                                     |
| ---                                                                                                            | ---                                                                                                                                                                                                                                                                                                                                         |
| [constant.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/constants.ts) | Defines essential symbols used throughout the NestJS-AWS-Parameter-Store-Config project to manage configuration properties, parameters, and the AWS SSM client, enabling a standardized approach for accessing AWS Parameter Store values within the applications architecture.                                                             |
| [index.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/index.ts)         | Exports crucial elements for integrating AWS Parameter Store with a NestJS application, including configuration parameters, a dedicated module for configuration management, and a service for accessing these configurations. Essential for developers aiming to leverage AWS Parameter Store for application settings in NestJS projects. |

</details>

<details closed><summary>src.shared.interface.config</summary>

| File                                                                                                                                                                                   | Summary                                                                                                                                                                                                                                                                                                                                 |
| ---                                                                                                                                                                                    | ---                                                                                                                                                                                                                                                                                                                                     |
| [properties-factory.interface.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/interface/config/properties-factory.interface.ts)           | Defines an interface for creating configuration options for AWS Parameter Store, ensuring a consistent approach in generating settings across the application. It centralizes the process of option creation, pivotal for integrating with AWS services efficiently within the NestJS-AWS-Parameter-Store-Config projects architecture. |
| [async-module-properties.interface.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/interface/config/async-module-properties.interface.ts) | Defines the structure for asynchronously configuring modules with AWS Parameter Store integration in the NestJS project, enabling dynamic properties fetching through factories or existing instances, thus facilitating flexible and scalable application configuration mechanisms within the projects architecture.                   |
| [properties.interface.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/interface/config/properties.interface.ts)                           | Defines the structure for Parameter Store configuration properties, including options for the AWS SSM client, decryption settings, the path to parameters, and recursion preferences, ensuring seamless integration and management of AWS parameters within the NestJS applications architecture.                                       |

</details>

<details closed><summary>src.shared.provider.config</summary>

| File                                                                                                                                                                    | Summary                                                                                                                                                                                                                                                                                                                                                                           |
| ---                                                                                                                                                                     | ---                                                                                                                                                                                                                                                                                                                                                                               |
| [config-parameters.provider.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/provider/config/config-parameters.provider.ts) | ParameterStoreConfigParametersProvider facilitates the retrieval of AWS SSM Parameter Store configurations, leveraging the ParameterStoreService. It dynamically fetches parameters based on configuration options like the path, decryption need, and recursion preference, ensuring seamless integration within the NestJS-AWS-Parameter-Store-Config repositorys architecture. |
| [properties.provider.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/provider/config/properties.provider.ts)               | Provides a mechanism for integrating AWS Parameter Store configurations into NestJS applications by offering a ValueProvider for IParameterStoreConfigProperties, enabling seamless access and management of configuration properties within the apps architecture.                                                                                                               |
| [ssm-client.provider.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/shared/provider/config/ssm-client.provider.ts)               | Creates a provider for the AWS SSM (Systems Manager) Client within a NestJS application, enabling seamless integration of AWS Parameter Store for application configuration. It leverages custom configuration properties to initialize the SSM Client, ensuring flexibility and scalability in managing environment-specific settings.                                           |

</details>

<details closed><summary>src.modules.config</summary>

| File                                                                                                                                    | Summary                                                                                                                                                                                                                                                                                                                                                        |
| ---                                                                                                                                     | ---                                                                                                                                                                                                                                                                                                                                                            |
| [config.module.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/modules/config/config.module.ts)   | Integrates AWS Parameter Store into NestJS applications, facilitating secure configuration management. Features include global access, dynamic module registration, and support for both synchronous and asynchronous setup. It bridges app configurations with AWS services via dedicated providers for parameters, properties, and AWS SSM client handling.  |
| [config.service.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/modules/config/config.service.ts) | Provides a seamless integration with AWS Parameter Store, enabling the retrieval of configurations as strings, booleans, or numbers. It simplifies accessing parameters with utility functions ensuring type safety and default value handling, enhancing the applications configuration management within the NestJS-AWS-Parameter-Store-Config architecture. |

</details>

<details closed><summary>src.modules.aws.parameter-store</summary>

| File                                                                                                                                                                   | Summary                                                                                                                                                                                                                                                                                                                                                                    |
| ---                                                                                                                                                                    | ---                                                                                                                                                                                                                                                                                                                                                                        |
| [parameter-store.service.ts](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/master/src/modules/aws/parameter-store/parameter-store.service.ts) | Enables dynamic retrieval of AWS Systems Manager (SSM) Parameter Store values, offering features such as recursive fetching and optional decryption. Critical for securely managing application configurations directly from AWS, ensuring sensitive parameters are efficiently accessed and managed within the NestJS-AWS-Parameter-Store-Config repository architecture. |

</details>

---

##  Getting Started

###  Installation


> ```console
> $ npm install @elsikora/nestjs-aws-parameter-store-config @aws-sdk/client-ssm
> ```
---

## Configuration

### Static configuration

```typescript
import { Module } from '@nestjs/common';
import { ParameterStoreConfigModule } from '@elsikora/nestjs-aws-parameter-store-database';

@Module({
  imports: [
    ParameterStoreConfigModule.register({
      ssmParamStorePath: '/production/services/my-modules',
      ssmDecryptParams: true,
      ssmRecursive: false,
      ssmClientOptions: {
        region: 'us-east-1',
      },
    }),
  ],
})
export class AppModule {}
```

By calling `ParameterStoreConfigModule.register`, you configure the module to load all the parameters under the path `ssmParamStorePath`.

### Async configuration

The following example shows how to retrieve the configuration before registering the module.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/database';
import { ParameterStoreConfigModule } from '@elsikora/nestjs-aws-parameter-store-database';

@Module({
  imports: [
    ParameterStoreConfigModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService<EnvironmentVariables>) => ({
        ssmParamStorePath: config.get<string>('APP_CONFIG_PATH'),
        ssmDecryptParams: true,
        ssmRecursive: false,
        ssmClientOptions: {
          region: config.get<string>('AWS_REGION'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```
---
## Options

| Option            	     | Required 	 | Default     	| Description                                                       	                                                                                            |
|-------------------------|------------|-------------	|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| basePath 	              | no      	  |             	| The hierarchy for the parameter                                   	                                                                                            |
| application 	           | no      	  |             	| Also you can provide application and environment name to load from (equals to `${application}/${environment}` in $basePath                                   	 |
| environment 	           | no      	  |             	| Also you can provide application and environment name to load from (equals to `${application}/${environment}` in $basePath                                 	                                                                                            |
| decryptParameters  	    | No       	 | `false`     	| Retrieve all parameters in a hierarchy with their value decrypted 	                                                                                            |
| recursiveLoading      	 | No       	 | `false`     	| Retrieve all parameters within a hierarchy                        	                                                                                            |
| config  	               | No       	 | `undefined` 	| Properties to pass to the underlying SSM client                      	                                                                                         |

---
## Services

This module exposes the following services.

### ConfigService

The `ParameterStoreConfigService` service allows you to access the configuration loaded from Parameter Store. Use its own class name as the injection token.

Let's assume the following parameters were previously registered:

- `/production/services/my-service/pagination-limit`: '25'
- `/production/services/my-service/post-table`: 'ProductionPostTable'

Configure the module with `ssmParamStorePath` pointing to `/production/services/my-service` to access all the parameters register for the service in production.

Then, access the configuration as follows:

```typescript
import { Injectable } from '@nestjs/common';
import { ParameterStoreConfigService } from '@elsikora/nestjs-aws-parameter-store-database';
import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

@Injectable()
export class PostRepository {
  // Some common initialization.
  public constructor(
    private readonly dynamodbClient: DynamoDBClient,
    private readonly ParameterStoreConfigService: ParameterStoreConfigService,
  ) {}

  public getPostsByUser(userId: string) {
    // Here: Note how to retrieve the configuration.
    const table = await this.ParameterStoreConfigService.get'post-table');
    const limit = await this.ParameterStoreConfigService.get'pagination-limit');

    const queryCommand = new QueryCommand({
      TableName: table, // <- use
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: `USER#${userId}` },
      },
      Limit: limit,  // <- use
    });

    const { Items = [] } = await this.dynamodbClient.send(queryCommand);
    // .... snip ....
  }
}
```

The `ParameterStoreConfigService` service exposes the following methods:

- `get(name, defaultValue)`: To retrieve a string configuration.

### How does the ParameterStoreConfigService service resolve the configurations?

When calling `get`, `getBool`, or `getNumber`, the service will look up a parameter whose name ends with the name specified. This means that the match is partial.

Given the following parameter:

- `/production/services/my-service/pagination-limit`: '25'

It can be retrieved using one of these alternatives:

- `get('pagination-limit')`
- `get('my-service/pagination-limit')`
- `get('services/my-service/pagination-limit')`
- `get('production/services/my-service/pagination-limit')`

### Raw Parameters

You can access the raw parameters loaded from the Parameter Store.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PARAMETER_STORE_CONFIG_PARAMETERS, PSConfigParameters } from '@elsikora/nestjs-aws-parameter-store-database';

@Injectable()
export class SophisticatedService {
  public constructor(
    @Inject(PARAMETER_STORE_CONFIG_PARAMETERS) parameters: PSConfigParameters,
  ) {
    console.log(parameters);
  }
}
```

Example of output:

```json
[
  {
      "Name": "/production/services/my-modules/pagination-limit",
      "Type": "String",
      "Value": "25",
      "Version": 1,
      "LastModifiedDate": "2022-09-03T02:55:00.389000-04:00",
      "ARN": "arn:aws:ssm:us-east-1:000000000000:parameter/production/services/my-modules/pagination-limit",
      "DataType": "text"
  },
  {
      "Name": "/production/services/my-modules/post-table",
      "Type": "String",
      "Value": "ProductionPostTable",
      "Version": 1,
      "LastModifiedDate": "2022-09-03T03:15:15.032000-04:00",
      "ARN": "arn:aws:ssm:us-east-1:000000000000:parameter/production/services/my-modules/post-table",
      "DataType": "text"
  }
]
```

---
## Troubleshooting

### Empty list of parameters returned

This happens when `recursive` is `false` and the specified path does not resolve the final level in the hierarchy.

[Reference: GetParametersByPath](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_GetParametersByPath.html#API_GetParametersByPath_RequestSyntax)

```typescript
import { Module } from '@nestjs/common';
import { ParameterStoreConfigModule } from '@elsikora/nestjs-aws-parameter-store-database';

@Module({
  imports: [
    ParameterStoreConfigModule.register({
      ssmParamStorePath: '/production',
      ssmRecursive: true,   // <-- specify recursively
    }),
  ],
})
export class AppModule {}
```

##  Contributing

Contributions are welcome! Here are several ways you can contribute:

- **[Report Issues](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/issues)**: Submit bugs found or log feature requests for the `NestJS-AWS-Parameter-Store-Config` project.
- **[Submit Pull Requests](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/blob/main/CONTRIBUTING.md)**: Review open PRs, and submit your own PRs.
- **[Join the Discussions](https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/discussions)**: Share your insights, provide feedback, or ask questions.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine using a git client.
   ```sh
   git clone https://github.com/ElsiKora/NestJS-AWS-Parameter-Store-Config.git
   ```
3. **Create a New Branch**: Always work on a new branch, giving it a descriptive name.
   ```sh
   git checkout -b new-feature-x
   ```
4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message describing your updates.
   ```sh
   git commit -m 'Implemented new feature x.'
   ```
6. **Push to github**: Push the changes to your forked repository.
   ```sh
   git push origin new-feature-x
   ```
7. **Submit a Pull Request**: Create a PR against the original project repository. Clearly describe the changes and their motivations.
8. **Review**: Once your PR is reviewed and approved, it will be merged into the main branch. Congratulations on your contribution!
</details>

<details closed>
<summary>Contributor Graph</summary>
<br>
<p align="center">
   <a href="https://github.com{/ElsiKora/NestJS-AWS-Parameter-Store-Config.git/}graphs/contributors">
      <img src="https://contrib.rocks/image?repo=ElsiKora/NestJS-AWS-Parameter-Store-Config.git">
   </a>
</p>
</details>

---

##  License

This project is protected under the MIT License. For more details, refer to the [LICENSE](https://choosealicense.com/licenses/) file.

---

##  Acknowledgments

- List any resources, contributors, inspiration, etc. here.

[**Return**](#-overview)

---
