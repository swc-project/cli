import * as swc from "@swc/core";
import fs from "fs";
import defaults from "lodash/defaults";
import { sync as mkdirpSync } from "mkdirp";
// @ts-ignore
import outputFileSync from "output-file-sync";
import path from "path";
import slash from "slash";

import { CliOptions } from "./options";
import * as util from "./util";

export default async function ({
  cliOptions,
  swcOptions
}: {
  cliOptions: CliOptions;
  swcOptions: swc.Config;
}) {
  const filenames = cliOptions.filenames;

  /**
   * Returns `undefined` if a file is ignored.
   */
  async function write(src: string, base: string): Promise<boolean | undefined> {
    let relative = path.relative(base, src);

    if (!util.isCompilableExtension(relative, cliOptions.extensions)) {
      return undefined;
    }

    // remove extension and then append back on .js
    relative = util.adjustRelative(relative, cliOptions.keepFileExtension);

    const dest = getDest(relative, base);

    try {
      const res = await util.compile(
        src,
        defaults(
          {
            sourceFileName: slash(path.relative(dest + "/..", src))
          },
          swcOptions
        ),
        cliOptions.sync
      );

      if (!res) return false;

      let code = res.code;
      // we've requested explicit sourcemaps to be written to disk
      if (res.map) {
        let map = JSON.parse(res.map);

        // TODO: Handle inline source map

        const mapLoc = dest + ".map";
        code = util.addSourceMappingUrl(code, mapLoc);
        map.file = path.basename(relative);
        outputFileSync(mapLoc, JSON.stringify(map));
      }

      outputFileSync(dest, code);
      util.chmod(src, dest);

      if (cliOptions.verbose) {
        console.log(src + " -> " + dest);
      }

      return true;
    } catch (err) {
      if (cliOptions.watch) {
        console.error(err);
        return false;
      }

      throw err;
    }
  }

  function getDest(filename: string, base: string) {
    if (cliOptions.relative) {
      return path.join(base, cliOptions.outDir, filename);
    }
    return path.join(cliOptions.outDir, filename);
  }

  /**
   * Returns `undefined` if a file is ignored.
   */
  async function handleFile(src: string, base: string): Promise<boolean | undefined> {
    const written = await write(src, base);

    if (!written && cliOptions.copyFiles) {
      const filename = path.relative(base, src);
      const dest = getDest(filename, base);
      outputFileSync(dest, fs.readFileSync(src));
      util.chmod(src, dest);
    }
    return written;
  }

  type HandleResult = { succeeded: number; failed: number }

  async function handle(filenameOrDir: string): Promise<HandleResult> {
    if (!fs.existsSync(filenameOrDir)) return { succeeded: 0, failed: 0 };
    const stat = fs.statSync(filenameOrDir);

    if (stat.isDirectory()) {
      const dirname = filenameOrDir;

      let succeeded = 0;
      let failed = 0;

      const files = util.readdir(dirname, cliOptions.includeDotfiles);

      await Promise.all(
        files.map(async (filename: string) => {
          const src = path.join(dirname, filename);
          try {
            const written = await handleFile(src, dirname);
            if (written) {
              succeeded += 1;
            } else if (written === false) {
              failed += 1;
            }
          } catch (e) {
            console.error(e);
            failed += 1;
          }
        })
      );

      return { succeeded, failed };
    } else {
      const filename = filenameOrDir;
      const written = await handleFile(filename, path.dirname(filename));

      return {
        succeeded: written ? 1 : 0,
        failed: written === false ? 1 : 0
      };
    }
  }

  if (cliOptions.deleteDirOnStart) {
    util.deleteDir(cliOptions.outDir);
  }
  mkdirpSync(cliOptions.outDir);

  let compiledFiles = 0;
  let failedFiles = 0;

  for (const filename of cliOptions.filenames) {
    const { succeeded, failed } = await handle(filename);
    compiledFiles += succeeded
    failedFiles += failed
  }

  if (!cliOptions.quiet) {
    if (compiledFiles > 0) {
      console.log(
        `Successfully compiled ${compiledFiles} ${compiledFiles !== 1 ? "files" : "file"
        } with swc.`
      );
    }

    if (failedFiles > 0) {
      const error = `Failed to compile ${failedFiles} ${failedFiles !== 1 ? "files" : "file"
        } with swc.`
      if (!cliOptions.watch) throw new Error(error)
      else console.error(error)
    }
  }

  if (cliOptions.watch) {
    const chokidar = util.requireChokidar();

    filenames.forEach(function (filenameOrDir) {
      const watcher = chokidar.watch(filenameOrDir, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 50,
          pollInterval: 10
        }
      });

      ["add", "change"].forEach(function (type) {
        watcher.on(type, function (filename: string) {
          const start = process.hrtime()

          handleFile(
            filename,
            filename === filenameOrDir
              ? path.dirname(filenameOrDir)
              : filenameOrDir
          )
            .then(ok => {
              if (cliOptions.logWatchCompilation && ok) {
                const [seconds, nanoseconds] = process.hrtime(start);
                const ms = (seconds * 1000000000 + nanoseconds) / 1000000;
                const name = path.basename(filename);
                console.log(`Compiled ${name} in ${ms.toFixed(2)}ms`);
              }
            })
            .catch(console.error);
        });
      });
    });
  }
}
