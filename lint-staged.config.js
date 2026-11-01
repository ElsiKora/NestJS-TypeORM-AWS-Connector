export default {
	"*": (files) => {
		const eslintFiles = files.filter((fileName) => {
			const validExtensions = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "json", "jsonc", "yml", "yaml"];
			const fileExtension = fileName.split(".").pop();
			const hasValidExtension = validExtensions.includes(fileExtension);
			const hasNoExtension = !fileName.includes(".");

			return hasValidExtension && !hasNoExtension;
		});

		const commands = [`prettier --write --ignore-unknown ${files.join(" ")}`];

		if (eslintFiles.length > 0) {
			commands.push(`eslint --fix --max-warnings=0 --no-ignore ${eslintFiles.join(" ")}`);
		}

		return commands;
	},
};
