const ERROR_TYPE_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const FALLBACK_ERROR_TYPE: string = "UnknownError";
const MAXIMUM_EVIDENCE_OBJECTS: number = 8;
const SQL_STATE_PATTERN: RegExp = /^[0-9A-Z]{5}$/u;

/**
 * Formats bounded, non-sensitive evidence for an unknown failure.
 * @param {unknown} error - Failure candidate.
 * @returns {string} Validated error type and optional SQLSTATE evidence.
 */
export function FormatErrorEvidence(error: unknown): string {
	const errorType: string = readErrorType(error);
	const sqlState: string | undefined = readSqlState(error);

	return sqlState === undefined ? `errorType=${errorType}` : `errorType=${errorType} sqlState=${sqlState}`;
}

/**
 * Determines whether an unknown value can carry descriptor-based evidence.
 * @param {unknown} value - Candidate value.
 * @returns {boolean} Whether the value is object-like.
 */
function isObject(value: unknown): value is object {
	return (typeof value === "object" && value !== null) || typeof value === "function";
}

/**
 * Reads a bounded machine error type without evaluating arbitrary properties.
 * @param {unknown} error - Failure candidate.
 * @returns {string} Validated error type or the package fallback.
 */
function readErrorType(error: unknown): string {
	if (!isObject(error)) {
		return FALLBACK_ERROR_TYPE;
	}

	const ownName: unknown = readOwnDataProperty(error, "name");

	if (typeof ownName === "string" && ERROR_TYPE_PATTERN.test(ownName)) {
		return ownName;
	}

	const prototype: null | object = readPrototype(error);
	const constructor: unknown = prototype === null ? undefined : readOwnDataProperty(prototype, "constructor");
	const constructorName: unknown = isObject(constructor) ? readOwnDataProperty(constructor, "name") : undefined;

	if (typeof constructorName === "string" && ERROR_TYPE_PATTERN.test(constructorName)) {
		return constructorName;
	}

	return FALLBACK_ERROR_TYPE;
}

/**
 * Reads one own data property while ignoring accessors and hostile proxies.
 * @param {object} value - Object to inspect.
 * @param {PropertyKey} property - Known property key.
 * @returns {unknown} Own data value when safely available.
 */
function readOwnDataProperty(value: object, property: PropertyKey): unknown {
	try {
		const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(value, property);

		return descriptor && "value" in descriptor ? descriptor.value : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Reads one prototype while containing hostile proxy traps.
 * @param {object} value - Object to inspect.
 * @returns {null | object} Immediate prototype when safely available.
 */
function readPrototype(value: object): null | object {
	try {
		return Object.getPrototypeOf(value) as null | object;
	} catch {
		return null;
	}
}

/**
 * Reads a validated SQLSTATE from a bounded cause/driver graph.
 * @param {unknown} error - Failure candidate.
 * @returns {string | undefined} Valid SQLSTATE when present.
 */
function readSqlState(error: unknown): string | undefined {
	if (!isObject(error)) {
		return undefined;
	}

	const pendingNodes: Array<object> = [error];
	const visitedNodes: WeakSet<object> = new WeakSet<object>();
	let visitedNodeCount: number = 0;

	while (pendingNodes.length > 0 && visitedNodeCount < MAXIMUM_EVIDENCE_OBJECTS) {
		const node: object | undefined = pendingNodes.shift();

		if (node === undefined || visitedNodes.has(node)) {
			continue;
		}

		visitedNodes.add(node);
		visitedNodeCount++;

		const code: unknown = readOwnDataProperty(node, "code");

		if (typeof code === "string" && SQL_STATE_PATTERN.test(code)) {
			return code;
		}

		for (const property of ["driverError", "cause"] as const) {
			const candidate: unknown = readOwnDataProperty(node, property);

			if (isObject(candidate)) {
				pendingNodes.push(candidate);
			}
		}
	}

	return undefined;
}
