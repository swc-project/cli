import * as swc from "@swc/core";
import convertSourceMap from 'convert-source-map';
import { stat, chmodSync, statSync, mkdirSync, writeFileSync } from "fs";
import type { PathLike } from 'fs';
import glob from "glob";
import path from "path";
import slash from "slash";

export function chmod(src: PathLike, dest: PathLike) {
  chmodSync(dest, statSync(src).mode);
}

/**
 * Find all input files based on source globs
 */
export async function globSources(
  sources: string[],
  includeDotfiles = false
): Promise<Set<string>> {
  const globConfig = {
    dot: includeDotfiles,
    nodir: true,
    stat: false,
  };

  const files = await Promise.all(
    sources
      .filter(source => includeDotfiles || !path.basename(source).startsWith("."))
      .map((source) => {
        return new Promise<string[]>(resolve => {
          stat(source, (err, stat) => {
            if (err) {
              resolve([]);
              return;
            }
            if (!stat.isDirectory()) {
              resolve([source])
            } else {
              glob(path.join(source, "**"), globConfig, (err, matches) => {
                if (err) {
                  resolve([]);
                  return;
                }
                resolve(matches);
              });
            }
          });
        });
      })
  )
  return new Set<string>(files.flat());
}

export function watchSources(
  sources: string[],
  includeDotfiles = false
) {
  return requireChokidar().watch(sources, {
    ignored: includeDotfiles
      ? undefined
      : (filename: string) => path.basename(filename).startsWith("."),
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10
    }
  });
}

/**
 * Test if a filename ends with a compilable extension.
 */
export function isCompilableExtension(
  filename: string,
  altExts: string[]
): boolean {
  const ext = path.extname(filename);
  return altExts.includes(ext);
}

export async function transform(
  filename: string,
  code: string,
  opts: swc.Options,
  sync: boolean
): Promise<swc.Output> {
  opts = {
    filename,
    ...opts
  };

  if (sync) {
    return swc.transformSync(code, opts);
  }

  return swc.transform(code, opts);
}

export async function compile(
  filename: string,
  opts: swc.Options,
  sync: boolean
): Promise<swc.Output | undefined> {
  opts = {
    ...opts
  };

  try {
    const result = sync
      ? swc.transformFileSync(filename, opts)
      : await swc.transformFile(filename, opts);

    if (result.map) {
      const map = convertSourceMap.fromJSON(result.map);
      // TODO: fix this in core
      // https://github.com/swc-project/swc/issues/1388
      if (opts.sourceFileName) {
        map.getProperty('sources')[0] = opts.sourceFileName;
      }
      if (opts.sourceRoot) {
        map.setProperty('sourceRoot', opts.sourceRoot);
      }
      result.map = map.toJSON();
    }
    return result;
  } catch (err) {
    if (!err.message.includes("ignored by .swcrc")) {
      throw err;
    }
  }
}

export function outputFile(
  output: swc.Output,
  filename: string,
  sourceMaps: swc.Options['sourceMaps']
) {
  const destDir = path.dirname(filename);
  mkdirSync(destDir, { recursive: true });

  let code = output.code;
  if (output.map && sourceMaps && sourceMaps !== "inline") {
    // we've requested for a sourcemap to be written to disk
    const fileDirName = path.dirname(filename);
    const mapLoc = filename + ".map";
    code += "\n//# sourceMappingURL=" + slash(path.relative(fileDirName, mapLoc));
    writeFileSync(mapLoc, output.map);
  }

  writeFileSync(filename, code);
}

export function assertCompilationResult<T>(
  result: Map<string, Error | T>,
  quiet = false
): asserts result is Map<string, T> {
  let compiled = 0;
  let copied = 0;
  let failed = 0;
  for (const value of result.values()) {
    if (value instanceof Error) {
      failed++;
    } else if (value as unknown === 'copied') {
      copied++;
    } else if (value) {
      compiled++;
    }
  }
  if (!quiet && compiled + copied > 0) {
    const copyResult = copied === 0 ? " " : ` (copied ${copied}) `;
    console.info(
      `Successfully compiled ${compiled} ${compiled !== 1 ? "files" : "file"}${copyResult}with swc.`
    );
  }

  if (failed > 0) {
    throw new Error(
      `Failed to compile ${failed} ${failed !== 1 ? "files" : "file"} with swc.`
    );
  }
}

export function requireChokidar(): (typeof import("chokidar")) {
  try {
    return require("chokidar");
  } catch (err) {
    console.error(
      "The optional dependency chokidar failed to install and is required for " +
      "--watch. Chokidar is likely not supported on your platform."
    );
    throw err;
  }
}
