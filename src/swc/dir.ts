import * as swc from "@swc/core";
import fs from "fs";
import path from "path";
import slash from "slash";

import { CliOptions } from "./options";
import { globSources, isCompilableExtension, watchSources } from "./sources";
import * as util from "./util";

export default async function ({
  cliOptions,
  swcOptions
}: {
  cliOptions: CliOptions;
  swcOptions: swc.Options;
}) {
  /**
   * Removes the leading directory, including all parent relative paths
   */
  function stripComponents(filename: string) {
    const components = filename.split('/').slice(1);
    if (!components.length) {
      return filename;
    }
    while (components[0] === '..') {
      components.shift();
    }
    return components.join('/');
  }

  function getDest(filename: string, ext?: string) {
    const relative = slash(path.relative(process.cwd(), filename));
    let base = stripComponents(relative);
    if (ext) {
      base = base.replace(/\.\w*$/, ext);
    }
    return path.join(cliOptions.outDir, base);
  }

  async function handle(filename: string) {
    if (isCompilableExtension(filename, cliOptions.extensions)) {
      const dest = getDest(filename, ".js");
      const sourceFileName = slash(path.relative(path.dirname(dest), filename));

      const result = await util.compile(
        filename,
        { ...swcOptions, sourceFileName },
        cliOptions.sync
      );

      if (result) {
        util.outputFile(result, dest, swcOptions.sourceMaps);
        util.chmod(filename, dest);
        return true;
      }
    } else if (cliOptions.copyFiles) {
      const dest = getDest(filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(filename, dest);
      return 'copied';
    }
    return false;
  }

  if (cliOptions.deleteDirOnStart) {
    console.log('clean dir1')
    fs.rmdirSync(cliOptions.outDir, { recursive: true })
  }
  fs.mkdirSync(cliOptions.outDir, { recursive: true });

  const results = new Map<string, Error | boolean | 'copied'>();
  for (const filename of await globSources(cliOptions.filenames, cliOptions.includeDotfiles)) {
    try {
      const result = await handle(filename);
      if (result !== undefined) {
        results.set(filename, result);
      }
    } catch (err) {
      console.error(err.message);
      results.set(filename, err);
    }
  }

  if (cliOptions.watch) {
    const watcher = await watchSources(cliOptions.filenames, cliOptions.includeDotfiles);
    watcher.on('ready', () => {
      try {
        util.assertCompilationResult(results, cliOptions.quiet);
        if (!cliOptions.quiet) {
          console.info('Watching for file changes.')
        }
      } catch (err) {
        console.error(err.message);
      }
    });
    watcher.on('unlink', (filename) => {
      try {
        if (isCompilableExtension(filename, cliOptions.extensions)) {
          fs.unlinkSync(getDest(filename, ".js"));
        } else if (cliOptions.copyFiles) {
          fs.unlinkSync(getDest(filename));
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(err.stack);
        }
      }
    });
    for (const type of ['add', 'change']) {
      watcher.on(type, (filename) => {
        const start = process.hrtime()

        handle(filename)
          .then((result) => {
            results.set(filename, result);
            if (result) {
              const [seconds, nanoseconds] = process.hrtime(start);
              const ms = seconds * 1000 + (nanoseconds * 1e-6);
              const name = path.basename(filename);
              console.log(`${result === "copied" ? "Copied" : "Compiled"} ${name} in ${ms.toFixed(2)}ms`);
            }
          })
          .catch((err) => {
            console.error(err.message);
            results.set(filename, err);
          });
      });
    }
  } else {
    util.assertCompilationResult(results, cliOptions.quiet);
    console.timeEnd("Compilation dir1")
  }
}
