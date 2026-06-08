import fs from "node:fs";
import path from "node:path";
import { NodeSSH } from "node-ssh";

const BACKUP_DIR_NAME = "backups";
const noop = () => {};

function assertBackupName(fileName) {
  if (
    typeof fileName !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/i.test(fileName)
  ) {
    throw new Error(`备份文件名无效: ${fileName}`);
  }
}

function readDirectory(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (error, entries) => {
      if (error) reject(error);
      else resolve(entries);
    });
  });
}

function unlinkFile(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function createSshClient({
  serverConfig,
  ssh = new NodeSSH(),
  fsImpl = fs,
  onConnectStart = noop,
  onConnectComplete = noop,
  onUploadStart = noop,
  onUploadProgress = noop,
  onUploadComplete = noop,
  onDeployStart = noop,
  onDeployComplete = noop,
  onRemoteWarning = noop,
}) {
  const { webDir, readyTimeout = 20000, ...connectionConfig } =
    serverConfig;
  const backupDir = path.posix.join(webDir, BACKUP_DIR_NAME);

  return {
    async connect() {
      onConnectStart();
      await ssh.connect({ ...connectionConfig, readyTimeout });
      onConnectComplete();
    },

    async uploadBackup(localPath, zipName) {
      assertBackupName(zipName);
      const total = fsImpl.statSync(localPath).size;
      const remotePath = path.posix.join(backupDir, zipName);

      onUploadStart({ localPath, remotePath, total });
      await ssh.mkdir(backupDir);
      await ssh.putFile(localPath, remotePath, null, {
        step: (transferred) =>
          onUploadProgress({ transferred, total }),
      });
      onUploadComplete({ localPath, remotePath, total });
    },

    async deployBackup(zipName) {
      assertBackupName(zipName);
      onDeployStart(zipName);

      const relativeZipPath = path.posix.join(
        BACKUP_DIR_NAME,
        zipName
      );
      const cleanCommand = `find . -maxdepth 1 ! -name "${BACKUP_DIR_NAME}" ! -name "." -exec rm -rf -- {} +`;
      const result = await ssh.execCommand(
        `${cleanCommand} && unzip -o '${relativeZipPath}'`,
        { cwd: webDir }
      );

      if (result.code !== 0) {
        throw new Error(
          result.stderr ||
            `远程部署失败，退出码: ${result.code ?? "unknown"}`
        );
      }
      if (result.stderr) onRemoteWarning(result.stderr);
      onDeployComplete(zipName);
    },

    async listBackups() {
      let entries;
      try {
        await ssh.withSFTP(async (sftp) => {
          entries = await readDirectory(sftp, backupDir);
        });
      } catch (error) {
        if (error?.code === 2 || error?.code === "ENOENT") return [];
        throw error;
      }

      return entries
        .filter((entry) => {
          const isFile =
            typeof entry.attrs?.isFile !== "function" ||
            entry.attrs.isFile();
          return isFile && entry.filename.toLowerCase().endsWith(".zip");
        })
        .sort((left, right) => right.attrs.mtime - left.attrs.mtime)
        .map((entry) => entry.filename);
    },

    async deleteBackup(fileName) {
      assertBackupName(fileName);
      await ssh.withSFTP((sftp) =>
        unlinkFile(sftp, path.posix.join(backupDir, fileName))
      );
    },

    dispose() {
      ssh.dispose?.();
    },
  };
}
