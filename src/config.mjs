import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function withoutUndefinedEntries(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function validateConfig(input, { cwd = process.cwd() } = {}) {
  const config = input ?? {};
  const local = config.local ?? {};
  const server = config.server ?? {};
  const errors = [];

  if (!isNonEmptyString(local.buildCommand)) {
    errors.push("local.buildCommand 必须是非空字符串");
  }
  if (!isNonEmptyString(local.distPath)) {
    errors.push("local.distPath 必须是非空字符串");
  }
  if (!isNonEmptyString(server.host)) {
    errors.push("server.host 必须是非空字符串");
  }
  if (!isNonEmptyString(server.username)) {
    errors.push("server.username 必须是非空字符串");
  }
  if (!isNonEmptyString(server.webDir)) {
    errors.push("server.webDir 必须是远程绝对路径");
  } else {
    const normalizedWebDir = path.posix.normalize(server.webDir.trim());
    if (
      !normalizedWebDir.startsWith("/") ||
      normalizedWebDir === "/" ||
      normalizedWebDir === "."
    ) {
      errors.push("server.webDir 必须是非根目录的远程绝对路径");
    }
  }

  if (errors.length > 0) {
    throw new Error(`部署配置无效：\n- ${errors.join("\n- ")}`);
  }

  const normalizedServer = withoutUndefinedEntries({
    ...server,
    port: server.port ?? 22,
    webDir: path.posix.normalize(server.webDir.trim()),
  });

  if (
    isNonEmptyString(normalizedServer.privateKey) &&
    !normalizedServer.privateKey.includes("PRIVATE KEY")
  ) {
    normalizedServer.privateKeyPath = normalizedServer.privateKey;
    delete normalizedServer.privateKey;
  }

  return {
    projectDir: path.resolve(cwd),
    local: {
      ...local,
      buildCommand: local.buildCommand.trim(),
      distPath: path.resolve(cwd, local.distPath),
    },
    server: normalizedServer,
  };
}

export function loadConfig({
  cwd = process.cwd(),
  configFile = "deploy.config.js",
} = {}) {
  const configPath = path.resolve(cwd, configFile);
  if (!fs.existsSync(configPath)) {
    throw new Error(`当前目录下未找到 ${configFile} 配置文件`);
  }

  delete require.cache[configPath];
  return validateConfig(require(configPath), { cwd });
}
