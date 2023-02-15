#!/usr/bin/env node

import minVersion from "semver/ranges/min-version";
import { existsSync, readFileSync } from "fs";
import * as path from "path";
import { spawn, StdioOptions } from "child_process";
const { BinWrapper } = require("@mole-inc/bin-wrapper");

const { platform, arch } = process;

const SWC_CLI_ENV = {
  // Allow to specify specific version of swc binary version to use
  SWCX_CORE_VERSION_OVERRIDE: "SWCX_CORE_VERSION_OVERRIDE",
  // Allow to skip check peer @swc/core version check
  SWCX_SKIP_CORE_VERSION_CHECK: "SWCX_SKIP_CORE_VERSION_CHECK",
};

/**
 * Determines version of the swc cli binary to use.
 *
 * By default, if cwd have a package.json already have dependency to @swc/core
 * will try to match those versions. Otherwise will use the latest
 * version available when @swc/cli is published.
 *
 * If `SWCX_CORE_VERSION_OVERRIDE` is set, both will be ignored and
 * explicitly will try to use the version specified. Note this won't ceck
 * validity of the version.
 */
const getCoreVersion = () => {
  const latestVersion = "1.3.24";

  if (process.env[SWC_CLI_ENV.SWCX_CORE_VERSION_OVERRIDE]) {
    console.log(
      `Using swc core version from ${SWC_CLI_ENV.SWCX_CORE_VERSION_OVERRIDE} env variable`
    );
    return `${process.env[SWC_CLI_ENV.SWCX_CORE_VERSION_OVERRIDE]}`;
  }

  try {
    if (!process.env[SWC_CLI_ENV.SWCX_SKIP_CORE_VERSION_CHECK]) {
      const cwdPackageManifestPath = path.resolve(
        process.cwd(),
        "package.json"
      );
      if (existsSync(cwdPackageManifestPath)) {
        const {
          dependencies,
          devDependencies,
        } = require(cwdPackageManifestPath);
        const swcCoreVersion =
          dependencies?.["@swc/core"] || devDependencies?.["@swc/core"];
        if (swcCoreVersion) {
          return minVersion(swcCoreVersion);
        }
      } else {
        return latestVersion;
      }
    } else {
      console.log(
        `Skipping swc core version check due to ${SWC_CLI_ENV.SWCX_SKIP_CORE_VERSION_CHECK} env variable`
      );
    }
  } catch (e) {
    console.warn(
      `Failed to determine swc core version from package.json, using latest available version ${latestVersion} instead`,
      e
    );
  }

  return latestVersion;
};

const isMusl = () =>
  (() => {
    function isMusl() {
      if (!process.report || typeof process.report.getReport !== "function") {
        try {
          return readFileSync("/usr/bin/ldd", "utf8").includes("musl");
        } catch (e) {
          return true;
        }
      } else {
        const { glibcVersionRuntime } = (process.report.getReport() as any)
          .header;
        return !glibcVersionRuntime;
      }
    }

    return isMusl();
  })();

const getBinaryName = () => {
  const platformBinaryMap: Record<string, Partial<Record<string, string>>> = {
    win32: {
      x64: "swc-win32-x64-msvc.exe",
      ia32: "swc-win32-ia32-msvc.exe",
      arm64: "swc-win32-arm64-msvc.exe",
    },
    darwin: {
      x64: "swc-darwin-x64",
      arm64: "swc-darwin-arm64",
    },
    linux: {
      x64: `swc-linux-x64-${isMusl() ? "musl" : "gnu"}`,
      arm64: `swc-linux-arm64-${isMusl() ? "musl" : "gnu"}`,
      arm: "swc-linux-arm64-gnu",
    },
  };

  const binaryName = platformBinaryMap[platform][arch];

  if (!binaryName) {
    throw new Error(
      `Unsupported platform: binary ${binaryName} for '${platform} ${arch}' is not available`
    );
  }

  return binaryName;
};

const executeBinary = async () => {
  const coreVersion = getCoreVersion();
  const releaseBase = `https://github.com/swc-project/swc/releases/download/v${coreVersion}`;
  const binaryName = getBinaryName();

  const bin = new BinWrapper({
    // do not explicitly run the binary to check existence to avoid
    // redundant spawn
    skipCheck: true,
  })
    .src(`${releaseBase}/${binaryName}`, platform, arch)
    .dest(`node_modules/.bin/swc-cli-${coreVersion}`)
    .use(binaryName);

  await bin.run();

  const binPath = bin.path;

  const [, , ...args] = process.argv;
  const options = { cwd: process.cwd(), stdio: "inherit" as StdioOptions };

  return spawn(binPath, args, options);
};

executeBinary().catch(e => console.error(e));
