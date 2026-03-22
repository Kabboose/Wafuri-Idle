import "dotenv/config";

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getTestDatabaseUrl } from "../src/test/testDatabase.ts";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDatabaseUrl = getTestDatabaseUrl();
const testEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_TEST: testDatabaseUrl
};

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: serverRoot,
      stdio: "inherit",
      env: testEnvironment
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

await runCommand(process.execPath, ["../node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
await runCommand(process.execPath, [
  "--test",
  "--test-global-setup=./dist/test/globalSetup.js",
  "dist/**/*.test.js"
]);
