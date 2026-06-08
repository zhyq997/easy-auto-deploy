import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { validateConfig } from "../src/config.mjs";

function createConfig(overrides = {}) {
  return {
    local: {
      buildCommand: "pnpm build",
      distPath: "./dist",
      ...overrides.local,
    },
    server: {
      host: "example.com",
      port: 22,
      username: "deploy",
      password: "secret",
      webDir: "/var/www/example",
      ...overrides.server,
    },
  };
}

test("normalizes a valid deployment configuration", () => {
  const cwd = path.resolve("fixtures/project");

  const config = validateConfig(createConfig(), { cwd });

  assert.equal(config.local.buildCommand, "pnpm build");
  assert.equal(config.local.distPath, path.resolve(cwd, "dist"));
  assert.equal(config.server.webDir, "/var/www/example");
});

test("reports every missing required configuration field", () => {
  assert.throws(
    () => validateConfig({ local: {}, server: {} }),
    /local\.buildCommand.*local\.distPath.*server\.host.*server\.username.*server\.webDir/s
  );
});

test("rejects dangerous remote deployment directories", () => {
  for (const webDir of ["", ".", "/"]) {
    assert.throws(
      () => validateConfig(createConfig({ server: { webDir } })),
      /server\.webDir/
    );
  }
});

test("converts a private key file path to node-ssh privateKeyPath", () => {
  const config = validateConfig(
    createConfig({
      server: {
        password: undefined,
        privateKey: "C:/Users/deploy/.ssh/id_rsa",
      },
    })
  );

  assert.equal(
    config.server.privateKeyPath,
    "C:/Users/deploy/.ssh/id_rsa"
  );
  assert.equal("privateKey" in config.server, false);
});
