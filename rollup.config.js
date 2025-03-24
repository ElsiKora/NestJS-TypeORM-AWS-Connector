import typescript from "@rollup/plugin-typescript";
import generatePackageJson from "rollup-plugin-generate-package-json";
const external = ["@elsikora/nestjs-aws-parameter-store-config", "@aws-sdk/client-ssm", "@aws-sdk/client-secrets-manager", "@nestjs/config", "@nestjs/schedule", "typeorm", "@nestjs/common"];
import resolve from "@rollup/plugin-node-resolve";
import dtsPathAlias from "rollup-plugin-dts-path-alias";

export default [
	{
		external,
		input: "src/index.ts",
		output: {
			dir: "dist/esm",
			entryFileNames: (chunkInfo) => {
				if (chunkInfo.name.includes("node_modules")) {
					return chunkInfo.name.replace("node_modules", "external") + ".js";
				}

				return "[name].js";
			},
			format: "esm",
			preserveModules: true,
			preserveModulesRoot: "src",
			sourcemap: true,
		},
		plugins: [
			resolve({
				include: ["node_modules/tslib/**"],
			}),
			dtsPathAlias(),
			typescript({
				declaration: true,
				declarationDir: "dist/esm",
				outDir: "dist/esm",
				sourceMap: true,
				tsconfig: "./tsconfig.build.json",
			}),
			generatePackageJson({
				baseContents: { type: "module" },
				outputFolder: "dist/esm",
			}),
		],
	},
	{
		external,
		input: "src/index.ts",
		output: {
			dir: "dist/cjs",
			entryFileNames: (chunkInfo) => {
				if (chunkInfo.name.includes("node_modules")) {
					return chunkInfo.name.replace("node_modules", "external") + ".js";
				}

				return "[name].js";
			},
			exports: "named",
			format: "cjs",
			preserveModules: true,
			preserveModulesRoot: "src",
			sourcemap: true,
		},
		plugins: [
			resolve({
				include: ["node_modules/tslib/**"],
			}),

			typescript({
				declaration: true,
				declarationDir: "dist/cjs",
				outDir: "dist/cjs",
				sourceMap: true,
				tsconfig: "./tsconfig.build.json",
			}),
			dtsPathAlias(),
			generatePackageJson({
				baseContents: { type: "commonjs" },
				outputFolder: "dist/cjs",
			}),
		],
	},
];
