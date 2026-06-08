import { getBackupsToDelete } from "./backup-retention.mjs";

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate()
  )}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(
    date.getSeconds()
  )}`;
}

export function createDeployService({
  archive,
  remote,
  now = () => new Date(),
}) {
  return {
    async deploy() {
      const zipName = `dist_${formatTimestamp(now())}.zip`;

      try {
        await archive.build();
        const localZipPath = await archive.zip(zipName);
        await remote.connect();
        await remote.uploadBackup(localZipPath, zipName);
        await remote.deployBackup(zipName);

        const backupsToDelete = getBackupsToDelete(
          await remote.listBackups()
        );
        for (const backup of backupsToDelete) {
          await remote.deleteBackup(backup);
        }

        return { version: zipName };
      } finally {
        try {
          await archive.cleanup(zipName);
        } finally {
          await remote.dispose();
        }
      }
    },

    async listBackups() {
      try {
        await remote.connect();
        return await remote.listBackups();
      } finally {
        await remote.dispose();
      }
    },

    async rollback(version) {
      try {
        await remote.connect();
        await remote.deployBackup(version);
        return { version };
      } finally {
        await remote.dispose();
      }
    },
  };
}
