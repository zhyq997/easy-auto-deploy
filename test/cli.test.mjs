import test from "node:test";
import assert from "node:assert/strict";

import { runCli } from "../src/cli.mjs";

function createPrompt(answers) {
  let index = 0;
  return async () => answers[index++];
}

function createLogger() {
  return {
    messages: [],
    errors: [],
    log(message) {
      this.messages.push(String(message));
    },
    error(message) {
      this.errors.push(String(message));
    },
  };
}

test("deploy menu action invokes the deployment service", async () => {
  let deployed = false;
  const logger = createLogger();
  const exitCode = await runCli({
    deployService: {
      async deploy() {
        deployed = true;
        return { version: "dist_test.zip" };
      },
    },
    prompt: createPrompt([{ action: "deploy" }]),
    logger,
  });

  assert.equal(deployed, true);
  assert.equal(exitCode, 0);
  assert.match(logger.messages.at(-1), /发布成功/);
});

test("rollback menu action confirms and deploys the selected version", async () => {
  let rolledBackVersion;
  const exitCode = await runCli({
    deployService: {
      async listBackups() {
        return ["new.zip", "old.zip"];
      },
      async rollback(version) {
        rolledBackVersion = version;
      },
    },
    prompt: createPrompt([
      { action: "rollback" },
      { version: "old.zip" },
      { ok: true },
    ]),
    logger: createLogger(),
  });

  assert.equal(rolledBackVersion, "old.zip");
  assert.equal(exitCode, 0);
});

test("service failures produce a non-zero exit status", async () => {
  const logger = createLogger();
  const exitCode = await runCli({
    deployService: {
      async deploy() {
        throw new Error("deployment failed");
      },
    },
    prompt: createPrompt([{ action: "deploy" }]),
    logger,
  });

  assert.equal(exitCode, 1);
  assert.match(logger.errors[0], /deployment failed/);
});
