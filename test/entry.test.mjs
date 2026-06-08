import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("importing the package entry does not start the CLI", async () => {
  const previousExitCode = process.exitCode;

  const entry = await import("../index.mjs");

  assert.equal(typeof entry.main, "function");
  assert.equal(process.exitCode, previousExitCode);
});

test("direct execution detection resolves command symlinks", async () => {
  const { isDirectExecution } = await import("../index.mjs");
  const targetPath = path.resolve("package/index.mjs");
  const commandPath = path.resolve("bin/easy-deploy");
  const moduleUrl = pathToFileURL(targetPath).href;
  const realpath = (value) =>
    value === commandPath ? targetPath : value;

  assert.equal(
    isDirectExecution(moduleUrl, commandPath, realpath),
    true
  );
});
