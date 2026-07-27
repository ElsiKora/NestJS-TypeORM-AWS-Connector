import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
	const esmDeclarationRoot = path.resolve("dist/esm");
	const declarationRoots = [esmDeclarationRoot, path.resolve("dist/cjs")];
	const relativeSpecifierPattern = /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["'])(\.\.?\/[^"'()]+)(["'])/gu;
	const runtimeExtensionPattern = /\.(?:cjs|js|json|mjs|node)$/u;

	const collectDeclarationPaths = async (directoryPath) => {
		const declarationPaths = [];

		for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
			const entryPath = path.join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				declarationPaths.push(...(await collectDeclarationPaths(entryPath)));
			} else if (entry.name.endsWith(".d.ts")) {
				declarationPaths.push(entryPath);
			}
		}

		return declarationPaths;
	};

	let normalizedSpecifierCount = 0;

	for (const declarationPath of await collectDeclarationPaths(esmDeclarationRoot)) {
		const contents = await readFile(declarationPath, "utf8");

		const normalizedContents = contents.replace(relativeSpecifierPattern, (match, prefix, specifier, suffix) => {
			if (runtimeExtensionPattern.test(specifier)) {
				return match;
			}

			normalizedSpecifierCount += 1;

			return `${prefix}${specifier}.js${suffix}`;
		});

		if (normalizedContents !== contents) {
			await writeFile(declarationPath, normalizedContents);
		}
	}

	for (const declarationRoot of declarationRoots) {
		for (const declarationPath of await collectDeclarationPaths(declarationRoot)) {
			const contents = await readFile(declarationPath, "utf8");

			if (contents.includes("node_modules/")) {
				throw new Error(`Generated declaration contains a repository-local dependency path: ${path.relative(process.cwd(), declarationPath)}`);
			}

			if (declarationRoot === esmDeclarationRoot) {
				for (const match of contents.matchAll(relativeSpecifierPattern)) {
					if (!runtimeExtensionPattern.test(match[2])) {
						throw new Error(`Generated ESM declaration contains an extensionless relative specifier: ${path.relative(process.cwd(), declarationPath)} -> ${match[2]}`);
					}
				}
			}
		}
	}

	process.stdout.write(`Normalized ${String(normalizedSpecifierCount)} ESM declaration specifiers.\n`);
}

await main();
