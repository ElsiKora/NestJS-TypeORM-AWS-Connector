#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { builtinModules } = require("node:module");
const path = require("node:path");

const { parseAst } = require("rollup/parseAst");
const ts = require("typescript");

const outputRoot = path.resolve("dist");
const manifest = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
const runtimePackages = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]);
const builtins = new Set(builtinModules);

// Module-evaluation access to these globals means the package writes output or loads a .env file on import
const SIDE_EFFECT_MEMBERS = new Map([
	["console", undefined],
	["process", new Set(["loadEnvFile", "stderr", "stdout"])],
]);
// Nodes whose bodies run later (a call or an instance), not when the module is evaluated
const DEFERRED_NODE_TYPES = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);
const exportKeysCache = new Map();
const problems = [];

/**
 * Splits a bare specifier into its package name and its subpath.
 * @param {string} specifier - Bare specifier, for example `@nestjs/common/interfaces`.
 * @returns {{ name: string, subpath: string }} The package name and the subpath (`.` for the package root).
 */
function parseBareSpecifier(specifier) {
	const parts = specifier.split("/");
	const nameLength = specifier.startsWith("@") ? 2 : 1;

	return { name: parts.slice(0, nameLength).join("/"), subpath: parts.length > nameLength ? `./${parts.slice(nameLength).join("/")}` : "." };
}

/**
 * Returns the explicit `exports` keys of an installed package; wildcard keys are left out.
 * @param {string} name - Package name.
 * @returns {Set<string> | undefined} The explicit keys, or undefined when the package has no `exports` map.
 */
function getExplicitExportKeys(name) {
	if (!exportKeysCache.has(name)) {
		const packageManifest = JSON.parse(fs.readFileSync(path.resolve("node_modules", name, "package.json"), "utf8"));
		const { exports: exportMap } = packageManifest;
		let keys;

		if (typeof exportMap === "string" || Array.isArray(exportMap)) {
			keys = new Set(["."]);
		} else if (exportMap && typeof exportMap === "object") {
			const entries = Object.keys(exportMap);
			// An exports object without "./" keys is a conditions object for the root entry
			keys = new Set(entries.some((key) => key.startsWith(".")) ? entries.filter((key) => !key.includes("*")) : ["."]);
		}

		exportKeysCache.set(name, keys);
	}

	return exportKeysCache.get(name);
}

/**
 * Checks one relative specifier: it needs a `.js` extension and a file it resolves to.
 * @param {string} filePath - File that holds the specifier.
 * @param {string} specifier - Relative specifier.
 * @returns {string | undefined} The problem, or undefined when the specifier is valid.
 */
function checkRelativeSpecifier(filePath, specifier) {
	// A declaration resolves "./x.js" to "./x.d.ts"; type-only modules have no .js output
	const target = filePath.endsWith(".d.ts") ? specifier.replace(/\.js$/, ".d.ts") : specifier;

	if (!specifier.endsWith(".js")) {
		return "relative import without a .js extension";
	}

	if (!fs.existsSync(path.resolve(path.dirname(filePath), target))) {
		return "relative import without a matching file";
	}
}

/**
 * Checks one bare specifier: the package must be a dependency or peer and a subpath must be an explicit `exports` key.
 * @param {string} specifier - Bare specifier.
 * @returns {string | undefined} The problem, or undefined when the specifier is valid.
 */
function checkBareSpecifier(specifier) {
	if (specifier.startsWith("node:") || builtins.has(specifier)) {
		return;
	}

	const { name, subpath } = parseBareSpecifier(specifier);

	if (!runtimePackages.has(name)) {
		return `${name} is not in dependencies or peerDependencies`;
	}

	if (subpath === ".") {
		return;
	}

	const keys = getExplicitExportKeys(name);

	if (!keys?.has(subpath)) {
		return `subpath ${subpath} is not an explicit key in the exports of ${name}`;
	}
}

/**
 * Returns the side-effect global a member expression reads, such as `console.log` or `process.stdout`.
 * @param {object} node - ESTree node.
 * @returns {string | undefined} The accessed member, or undefined for any other node.
 */
function getSideEffectMember(node) {
	if (node.type !== "MemberExpression" || node.object.type !== "Identifier" || !SIDE_EFFECT_MEMBERS.has(node.object.name)) {
		return;
	}

	const properties = SIDE_EFFECT_MEMBERS.get(node.object.name);
	const property = node.computed ? undefined : node.property.name;

	if (!properties) {
		return `${node.object.name}.${property ?? "[computed]"}`;
	}

	if (property && properties.has(property)) {
		return `${node.object.name}.${property}`;
	}
}

/**
 * Returns the function an immediately invoked call runs, such as `(() => {})()` or `(function () {}).call(this)`.
 * @param {object} node - ESTree node.
 * @returns {object | undefined} The invoked function node, or undefined when the node is not such a call.
 */
function getInvokedFunction(node) {
	if (node.type !== "CallExpression" && node.type !== "NewExpression") {
		return;
	}

	let { callee } = node;

	if (callee.type === "MemberExpression" && !callee.computed && ["apply", "call"].includes(callee.property.name)) {
		callee = callee.object;
	}

	return DEFERRED_NODE_TYPES.has(callee.type) ? callee : undefined;
}

/**
 * Collects `console.*`, `process.stdout`, `process.stderr` and `process.loadEnvFile` accesses that run when the module is evaluated.
 * Function bodies, class methods and instance fields run later and are skipped; immediately invoked functions, decorators, static fields and static blocks are not.
 * @param {object} node - ESTree node.
 * @param {Array<string>} found - Accesses found so far, as `member at offset`.
 * @returns {void}
 */
function collectTopLevelSideEffects(node, found) {
	if (!node || typeof node.type !== "string" || DEFERRED_NODE_TYPES.has(node.type)) {
		return;
	}

	if ((node.type === "MethodDefinition" || node.type === "PropertyDefinition") && !node.static) {
		collectTopLevelSideEffects(node.computed ? node.key : undefined, found);

		for (const decorator of node.decorators ?? []) {
			collectTopLevelSideEffects(decorator, found);
		}

		return;
	}

	const invokedFunction = getInvokedFunction(node);

	if (invokedFunction) {
		collectTopLevelSideEffects(invokedFunction.body, found);
	}

	const member = getSideEffectMember(node);

	if (member) {
		found.push(`${member} at offset ${String(node.start)}`);
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === "start" || key === "end" || !value || typeof value !== "object") {
			continue;
		}

		for (const child of Array.isArray(value) ? value : [value]) {
			collectTopLevelSideEffects(child, found);
		}
	}
}

/**
 * Checks one generated file: every import specifier and, for JavaScript, module-evaluation output and .env loading.
 * @param {string} entryPath - Absolute file path.
 * @returns {void}
 */
function checkFile(entryPath) {
	const relativePath = path.relative(process.cwd(), entryPath);
	const fileContent = fs.readFileSync(entryPath, "utf8");

	if (fileContent.includes("node_modules/")) {
		problems.push(`${relativePath}: path into node_modules`);
	}

	// The TypeScript scanner skips comments and finds import, export, import type, import() and require() specifiers
	for (const { fileName: specifier } of ts.preProcessFile(fileContent, true, true).importedFiles) {
		const problem = specifier.startsWith(".") ? checkRelativeSpecifier(entryPath, specifier) : checkBareSpecifier(specifier);

		if (problem) {
			problems.push(`${relativePath}: "${specifier}": ${problem}`);
		}
	}

	if (!entryPath.endsWith(".js")) {
		return;
	}

	const sideEffects = [];
	collectTopLevelSideEffects(parseAst(fileContent), sideEffects);

	for (const sideEffect of sideEffects) {
		problems.push(`${relativePath}: ${sideEffect} runs on import`);
	}
}

/**
 * Scans the build output and records every problem.
 * @param {string} directoryPath - Directory to scan.
 * @returns {void}
 */
function scanDirectory(directoryPath) {
	for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
		const entryPath = path.join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			scanDirectory(entryPath);
		} else if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".js")) {
			checkFile(entryPath);
		}
	}
}

if (!fs.existsSync(outputRoot)) {
	process.stderr.write(`Build output does not exist: ${outputRoot}\n`);
	process.exit(1);
}

scanDirectory(outputRoot);

if (problems.length > 0) {
	process.stderr.write(`Build output has invalid imports or import side effects:\n${problems.map((problem) => `- ${problem}`).join("\n")}\n`);
	process.exit(1);
}

process.stdout.write("Every relative import in dist has a .js extension and a matching file, every bare import is a dependency or peer root or an explicit exports key, and no module writes output or loads a .env file on import.\n");
