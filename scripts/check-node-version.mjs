const majorVersion = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);

if (!Number.isInteger(majorVersion) || majorVersion < 24) {
  console.error(`Node.js 24+ is required for this repo. Current version: ${process.version}`);
  console.error("Run `nvm use` in the repo root before running project scripts.");
  process.exit(1);
}
