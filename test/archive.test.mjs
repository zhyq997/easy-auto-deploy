import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createArchive } from "../src/archive.mjs";

test("build passes the complete configured command to the system shell", async () => {
  const child = new EventEmitter();
  let receivedCommand;
  let receivedOptions;
  const archive = createArchive({
    projectDir: "C:/project",
    localConfig: {
      buildCommand: 'pnpm run build -- --mode "production test"',
      distPath: "C:/project/dist",
    },
    spawnCommand(command, options) {
      receivedCommand = command;
      receivedOptions = options;
      queueMicrotask(() => child.emit("close", 0));
      return child;
    },
  });

  await archive.build();

  assert.equal(
    receivedCommand,
    'pnpm run build -- --mode "production test"'
  );
  assert.equal(receivedOptions.shell, true);
  assert.equal(receivedOptions.cwd, "C:/project");
});

test("zip creates an archive from the configured distribution directory", async () => {
  const projectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "easy-deploy-archive-")
  );
  const distPath = path.join(projectDir, "dist");
  fs.mkdirSync(distPath);
  fs.writeFileSync(path.join(distPath, "index.html"), "deployed");
  const archive = createArchive({
    projectDir,
    localConfig: {
      buildCommand: "ignored",
      distPath,
    },
  });

  try {
    const zipPath = await archive.zip("dist_test.zip");

    assert.equal(zipPath, path.join(projectDir, "dist_test.zip"));
    assert.equal(fs.existsSync(zipPath), true);
    assert.ok(fs.statSync(zipPath).size > 0);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
