import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import archiver from "archiver";

const noop = () => {};

export function createArchive({
  projectDir,
  localConfig,
  fsImpl = fs,
  spawnCommand = spawn,
  archiverFactory = archiver,
  onBuildStart = noop,
  onBuildComplete = noop,
  onZipStart = noop,
  onZipComplete = noop,
}) {
  return {
    async build() {
      onBuildStart(localConfig.buildCommand);

      await new Promise((resolve, reject) => {
        const child = spawnCommand(localConfig.buildCommand, {
          stdio: "inherit",
          shell: true,
          cwd: projectDir,
        });

        child.once("error", reject);
        child.once("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`打包失败，退出码: ${code}`));
        });
      });

      onBuildComplete();
    },

    async zip(zipName) {
      if (!fsImpl.existsSync(localConfig.distPath)) {
        throw new Error(`找不到打包目录 "${localConfig.distPath}"`);
      }

      onZipStart(zipName);
      const localZipPath = path.resolve(projectDir, zipName);

      const bytes = await new Promise((resolve, reject) => {
        const output = fsImpl.createWriteStream(localZipPath);
        const archive = archiverFactory("zip", { zlib: { level: 9 } });

        output.once("close", () => resolve(archive.pointer()));
        output.once("error", reject);
        archive.once("error", reject);
        archive.pipe(output);
        archive.directory(localConfig.distPath, false);
        archive.finalize();
      });

      onZipComplete({ zipName, localZipPath, bytes });
      return localZipPath;
    },

    cleanup(zipName) {
      const localZipPath = path.resolve(projectDir, zipName);
      if (fsImpl.existsSync(localZipPath)) {
        fsImpl.unlinkSync(localZipPath);
      }
    },
  };
}
