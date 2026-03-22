import "dotenv/config";

import { spawn } from "node:child_process";

import { getTestDatabaseUrl } from "../src/test/testDatabase.ts";

const testDatabaseUrl = getTestDatabaseUrl();

const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-global-setup=./src/test/globalSetup.ts",
    "src/services/auth/*.test.ts"
  ],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_TEST: testDatabaseUrl
    }
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
