import test from "node:test";
import assert from "node:assert/strict";

import { createDeployService } from "../src/deploy-service.mjs";

function createAdapters({ deployError } = {}) {
  const events = [];
  const backups = [
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
    "dist_20260608_080000.zip",
    "dist_20260608_070000.zip",
    "dist_20260608_060000.zip",
  ];

  const archive = {
    async build() {
      events.push("build");
    },
    async zip(zipName) {
      events.push(`zip:${zipName}`);
      return `C:/project/${zipName}`;
    },
    cleanup(zipName) {
      events.push(`cleanup:${zipName}`);
    },
  };

  const remote = {
    async connect() {
      events.push("connect");
    },
    async uploadBackup(localPath, zipName) {
      events.push(`upload:${localPath}:${zipName}`);
    },
    async deployBackup(zipName) {
      events.push(`deploy:${zipName}`);
      if (deployError) throw deployError;
    },
    async listBackups() {
      events.push("list");
      return backups;
    },
    async deleteBackup(file) {
      events.push(`delete:${file}`);
    },
    dispose() {
      events.push("dispose");
    },
  };

  return { archive, remote, events };
}

test("deploy orchestrates adapters and removes backups older than five", async () => {
  const { archive, remote, events } = createAdapters();
  const service = createDeployService({
    archive,
    remote,
    now: () => new Date(2026, 5, 8, 12, 30, 45),
  });

  const result = await service.deploy();

  assert.equal(result.version, "dist_20260608_123045.zip");
  assert.deepEqual(events, [
    "build",
    "zip:dist_20260608_123045.zip",
    "connect",
    "upload:C:/project/dist_20260608_123045.zip:dist_20260608_123045.zip",
    "deploy:dist_20260608_123045.zip",
    "list",
    "delete:dist_20260608_070000.zip",
    "delete:dist_20260608_060000.zip",
    "cleanup:dist_20260608_123045.zip",
    "dispose",
  ]);
});

test("deploy cleans local files and disposes the connection after failure", async () => {
  const failure = new Error("remote deploy failed");
  const { archive, remote, events } = createAdapters({
    deployError: failure,
  });
  const service = createDeployService({
    archive,
    remote,
    now: () => new Date(2026, 5, 8, 12, 30, 45),
  });

  await assert.rejects(() => service.deploy(), failure);
  assert.deepEqual(events.slice(-2), [
    "cleanup:dist_20260608_123045.zip",
    "dispose",
  ]);
  assert.equal(events.includes("list"), false);
});

test("deploy disposes the connection even when local cleanup fails", async () => {
  const cleanupFailure = new Error("cleanup failed");
  const { archive, remote, events } = createAdapters();
  archive.cleanup = () => {
    events.push("cleanup");
    throw cleanupFailure;
  };
  const service = createDeployService({
    archive,
    remote,
    now: () => new Date(2026, 5, 8, 12, 30, 45),
  });

  await assert.rejects(() => service.deploy(), cleanupFailure);
  assert.deepEqual(events.slice(-2), ["cleanup", "dispose"]);
});

test("rollback deploys the selected backup without pruning history", async () => {
  const { archive, remote, events } = createAdapters();
  const service = createDeployService({ archive, remote });

  await service.rollback("dist_20260608_110000.zip");

  assert.deepEqual(events, [
    "connect",
    "deploy:dist_20260608_110000.zip",
    "dispose",
  ]);
});

test("listBackups owns and releases its remote connection", async () => {
  const { archive, remote, events } = createAdapters();
  const service = createDeployService({ archive, remote });

  const backups = await service.listBackups();

  assert.equal(backups.length, 7);
  assert.deepEqual(events, ["connect", "list", "dispose"]);
});
