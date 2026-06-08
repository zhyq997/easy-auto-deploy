import test from "node:test";
import assert from "node:assert/strict";

import { createSshClient } from "../src/ssh-client.mjs";

function createSftp(entries = []) {
  return {
    readdir(_remotePath, callback) {
      callback(null, entries);
    },
    unlink(_remotePath, callback) {
      callback(null);
    },
  };
}

test("listBackups returns ZIP files ordered by remote modification time", async () => {
  const sftp = createSftp([
    { filename: "notes.txt", attrs: { mtime: 500 } },
    { filename: "older.zip", attrs: { mtime: 100 } },
    { filename: "newer.zip", attrs: { mtime: 300 } },
    { filename: "middle.ZIP", attrs: { mtime: 200 } },
  ]);
  const ssh = {
    async withSFTP(callback) {
      await callback(sftp);
    },
  };
  const client = createSshClient({
    serverConfig: { webDir: "/var/www/example" },
    ssh,
  });

  const backups = await client.listBackups();

  assert.deepEqual(backups, ["newer.zip", "middle.ZIP", "older.zip"]);
});

test("deployBackup rejects a non-zero remote command exit code", async () => {
  const ssh = {
    async execCommand() {
      return { code: 2, stdout: "", stderr: "unzip failed" };
    },
  };
  const client = createSshClient({
    serverConfig: { webDir: "/var/www/example" },
    ssh,
  });

  await assert.rejects(
    () => client.deployBackup("dist_20260608_120000.zip"),
    /unzip failed/
  );
});

test("deployBackup rejects backup names containing path traversal", async () => {
  const client = createSshClient({
    serverConfig: { webDir: "/var/www/example" },
    ssh: {},
  });

  await assert.rejects(() => client.deployBackup("../outside.zip"), {
    message: /备份文件名无效/,
  });
});
