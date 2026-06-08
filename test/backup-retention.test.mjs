import test from "node:test";
import assert from "node:assert/strict";

import { getBackupsToDelete } from "../src/backup-retention.mjs";

test("does not delete backups when fewer than five ZIP files exist", () => {
  const backups = [
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
  ];

  assert.deepEqual(getBackupsToDelete(backups), []);
});

test("does not delete backups when exactly five ZIP files exist", () => {
  const backups = [
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
    "dist_20260608_080000.zip",
  ];

  assert.deepEqual(getBackupsToDelete(backups), []);
});

test("deletes only ZIP files older than the five most recent backups", () => {
  const backups = [
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
    "dist_20260608_080000.zip",
    "dist_20260608_070000.zip",
    "dist_20260608_060000.zip",
  ];

  assert.deepEqual(getBackupsToDelete(backups), [
    "dist_20260608_070000.zip",
    "dist_20260608_060000.zip",
  ]);
});

test("ignores non-ZIP files when applying the retention limit", () => {
  const backups = [
    "notes.txt",
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
    "dist_20260608_080000.zip",
    "keep.tar.gz",
    "dist_20260608_070000.zip",
  ];

  assert.deepEqual(getBackupsToDelete(backups), [
    "dist_20260608_070000.zip",
  ]);
});

test("treats uppercase ZIP extensions as backup archives", () => {
  const backups = [
    "dist_20260608_120000.zip",
    "dist_20260608_110000.zip",
    "dist_20260608_100000.zip",
    "dist_20260608_090000.zip",
    "dist_20260608_080000.zip",
    "dist_20260608_070000.ZIP",
  ];

  assert.deepEqual(getBackupsToDelete(backups), [
    "dist_20260608_070000.ZIP",
  ]);
});
