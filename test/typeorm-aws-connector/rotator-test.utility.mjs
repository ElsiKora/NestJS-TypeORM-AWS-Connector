import { RotatorService } from "@elsikora/nestjs-typeorm-aws-connector";

const DEFAULT_FAKE_OPTIONS = {
	database: "app",
	entities: [],
	extra: {
		max: 10,
	},
	host: "db-host",
	logging: false,
	password: "old-password",
	port: 5432,
	relationLoadStrategy: "query",
	synchronize: false,
	type: "postgres",
	username: "old-user",
};

const cloneExtraOptions = (value) => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return {};
	}

	return {
		...value,
	};
};

const createDeferred = () => {
	let reject;
	let resolve;

	const promise = new Promise((resolvePromise, rejectPromise) => {
		reject = rejectPromise;
		resolve = resolvePromise;
	});

	return {
		promise,
		reject,
		resolve,
	};
};

const createFakeDriver = (label, dataSource, behavior) => {
	const state = {
		disconnectCalls: 0,
		queryCalls: [],
		queryRunners: new Set(),
		releaseCalls: 0,
	};

	const driver = {
		connection: dataSource,
		createQueryRunner: (mode = "master") => {
			const queryRunner = {
				connection: driver.connection,
				driver,
				isReleased: false,
				manager: undefined,
				mode,
				query: async (query) => {
					state.queryCalls.push(query);

					if (behavior.queryImplementation) {
						return behavior.queryImplementation(query, queryRunner);
					}

					return [{ ok: 1 }];
				},
				release: async () => {
					if (queryRunner.isReleased) {
						return;
					}

					state.releaseCalls += 1;

					if (behavior.releaseImplementation) {
						await behavior.releaseImplementation(queryRunner);
					}

					queryRunner.isReleased = true;
					state.queryRunners.delete(queryRunner);
				},
			};

			queryRunner.manager = {
				queryRunner,
			};
			state.queryRunners.add(queryRunner);

			return queryRunner;
		},
		disconnect: async () => {
			state.disconnectCalls += 1;

			if (behavior.disconnectReleasesQueryRunners) {
				while (state.queryRunners.size > 0) {
					await state.queryRunners.values().next().value.release();
				}
			}

			if (behavior.disconnectImplementation) {
				await behavior.disconnectImplementation(driver);
			}
		},
		label,
		options: dataSource.options,
		state,
	};

	return driver;
};

const createFakeDataSource = ({ destroyImplementation, disconnectImplementation, disconnectReleasesQueryRunners = true, initializeImplementation, isInitialized = true, label, options = {}, queryImplementation, releaseImplementation }) => {
	const behavior = {
		destroyImplementation,
		disconnectImplementation,
		disconnectReleasesQueryRunners,
		initializeImplementation,
		queryImplementation,
		releaseImplementation,
	};

	const dataSource = {
		createQueryRunner(mode = "master") {
			return dataSource.driver.createQueryRunner(mode);
		},
		behavior,
		destroyCalls: 0,
		driver: undefined,
		initializeCalls: 0,
		initialize: async () => {
			dataSource.initializeCalls += 1;

			if (behavior.initializeImplementation) {
				await behavior.initializeImplementation(dataSource);
			}

			dataSource.isInitialized = true;

			return dataSource;
		},
		isInitialized,
		options: {
			...DEFAULT_FAKE_OPTIONS,
			...options,
			extra: {
				...cloneExtraOptions(DEFAULT_FAKE_OPTIONS.extra),
				...cloneExtraOptions(options.extra),
			},
		},
		setOptions(nextOptions) {
			const extra = {
				...cloneExtraOptions(dataSource.options.extra),
				...cloneExtraOptions(nextOptions.extra),
			};

			Object.assign(dataSource.options, nextOptions, {
				extra,
			});

			return dataSource;
		},
		destroy: async () => {
			dataSource.destroyCalls += 1;

			if (behavior.destroyImplementation) {
				await behavior.destroyImplementation(dataSource);
			} else {
				await dataSource.driver.disconnect();
			}

			dataSource.isInitialized = false;
		},
	};

	const driver = createFakeDriver(label, dataSource, behavior);

	dataSource.driver = driver;

	return dataSource;
};

const createFakeSchedulerRegistry = () => {
	const intervals = new Map();

	return {
		addInterval(name, interval) {
			intervals.set(name, interval);
		},
		deleteInterval(name) {
			if (!intervals.has(name)) {
				throw new Error(`Interval "${name}" does not exist.`);
			}

			intervals.delete(name);
		},
		doesExist(type, name) {
			return type === "interval" && intervals.has(name);
		},
		intervals,
	};
};

class TestRotatorService extends RotatorService {
	constructor(dataSource, schedulerRegistry, connectorService, rotationIntervalName, replacementDataSources) {
		super(dataSource, schedulerRegistry, connectorService, rotationIntervalName);
		this.replacementDataSources = Array.isArray(replacementDataSources) ? [...replacementDataSources] : [replacementDataSources];
	}

	createReplacementDataSource(options) {
		const replacementDataSource = this.replacementDataSources.shift();

		if (!replacementDataSource) {
			throw new Error("No replacement DataSource was queued for this test.");
		}

		replacementDataSource.createdWithOptions = options;

		return replacementDataSource;
	}
}

export { createDeferred, createFakeDataSource, createFakeSchedulerRegistry, TestRotatorService };
