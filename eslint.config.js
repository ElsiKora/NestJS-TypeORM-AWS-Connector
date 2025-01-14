import createConfig from '@elsikora/eslint-config';

export default [
  {
    ignores: [
  "**/node_modules/",
  "**/.git/",
  "**/dist/",
  "**/build/",
  "**/coverage/",
  "**/.vscode/",
  "**/.idea/",
  "**/*.min.js",
  "**/*.bundle.js",
  "**/dist/**/*",
  "**/coverage/**/*",
  "**/.nest/**/*",
  "*.spec.ts",
  "test/**/*",
  "**/node_modules/**/*",
  "**/.git/**/*",
  "nest-cli.json"
]
  },
  ...createConfig({
    withJavascript: true,
    withTypescript: true,
    withNest: true,
    withPrettier: true,
    withStylistic: true,
    withSonar: true,
    withUnicorn: true,
    withPerfectionist: false,
    withJson: true,
    withYaml: true,
    withCheckFile: true,
    withPackageJson: true,
    withNode: true,
    withRegexp: true,
    withTypeorm: true
  })
];
