import swc from "@swc/core";
import path from "path";
import slash from "slash";
import { SourceMapConsumer, SourceMapGenerator } from "source-map";

import { CliOptions } from "./options";
import { globSources, isCompilableExtension, watchSources } from "./sources";
import * as util from "./util";

export default async function ({
  cliOptions,
  swcOptions,
}: {
  cliOptions: CliOptions;
  swcOptions: swc.Options;
}) {
  async function concatResults(
    file: string,
    ...results: swc.Output[]
  ): Promise<swc.Output> {
    let added = false;
    const map = new SourceMapGenerator({
      file,
      sourceRoot: swcOptions.sourceRoot,
    });

    let code = "";
    let offset = 0;

    for (const result of results) {
      code += result.code + "\n";

      if (result.map) {
        added = true;

        const consumer = await new SourceMapConsumer(result.map);
        const sources = new Set<string>();

        consumer.eachMapping(mapping => {
          sources.add(mapping.source);
          map.addMapping({
            generated: {
              line: mapping.generatedLine + offset,
              column: mapping.generatedColumn,
            },
            original: {
              line: mapping.originalLine,
              column: mapping.originalColumn,
            },
            source: mapping.source,
          });
        });

        sources.forEach(source => {
          const content = consumer.sourceContentFor(source, true);
          if (content !== null) {
            map.setSourceContent(source, content);
          }
        });
      }
      offset = code.split("\n").length - 1;
    }

    if (!added) {
      return { code };
    }

    return {
      code,
      map: JSON.stringify(map),
    };
  }

  async function output(results: Iterable<swc.Output>) {
    const file =
      cliOptions.sourceMapTarget ||
      path.basename(cliOptions.outFile || "stdout");

    const result = await concatResults(file, ...results);

    if (cliOptions.outFile) {
      util.outputFile(result, cliOptions.outFile, swcOptions.sourceMaps);
    } else {
      process.stdout.write(result.code + "\n");
      if (result.map) {
        const map = `//#sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(
          JSON.stringify(result.map),
          "utf8"
        ).toString("base64")}`;
        process.stdout.write(map);
      }
    }
  }

  async function handle(filename: string) {
    const sourceFileName = slash(
      cliOptions.outFile
        ? path.relative(path.dirname(cliOptions.outFile), filename)
        : filename
    );
    return await util.compile(
      filename,
      {
        ...swcOptions,
        sourceFileName,
      },
      cliOptions.sync,
      cliOptions.outFile
    );
  }

  async function getProgram(
    previousResults: Map<string, swc.Output | Error> = new Map()
  ) {
    const results: typeof previousResults = new Map();

    for (const filename of await globSources(
      cliOptions.filenames,
      cliOptions.only,
      cliOptions.ignore,
      cliOptions.includeDotfiles
    )) {
      if (isCompilableExtension(filename, cliOptions.extensions)) {
        results.set(filename, previousResults.get(filename)!);
      }
    }
    return results;
  }

  async function files() {
    let results = await getProgram();
    for (const filename of results.keys()) {
      try {
        const result = await handle(filename);
        if (result) {
          results.set(filename, result);
        } else {
          results.delete(filename);
        }
      } catch (err: any) {
        console.error(err.message);
        results.set(filename, err);
      }
    }

    if (cliOptions.watch) {
      const watcher = await watchSources(
        cliOptions.filenames,
        cliOptions.includeDotfiles
      );
      watcher.on("ready", () => {
        Promise.resolve()
          .then(async () => {
            util.assertCompilationResult(results, cliOptions.quiet);
            await output(results.values());
            if (!cliOptions.quiet) {
              console.info("Watching for file changes.");
            }
          })
          .catch(err => {
            console.error(err.message);
          });
      });
      watcher.on("add", async filename => {
        if (isCompilableExtension(filename, cliOptions.extensions)) {
          // ensure consistent insertion order when files are added
          results = await getProgram(results);
        }
      });
      watcher.on("unlink", filename => {
        results.delete(filename);
      });
      for (const type of ["add", "change"]) {
        watcher.on(type, filename => {
          if (!isCompilableExtension(filename, cliOptions.extensions)) {
            return;
          }

          const start = process.hrtime();

          handle(filename)
            .then(async result => {
              if (!result) {
                results.delete(filename);
                return;
              }
              results.set(filename, result);
              util.assertCompilationResult(results, true);
              await output(results.values());
              if (!cliOptions.quiet) {
                const [seconds, nanoseconds] = process.hrtime(start);
                const ms = seconds * 1000 + nanoseconds * 1e-6;
                const name = path.basename(cliOptions.outFile);
                console.log(`Compiled ${name} in ${ms.toFixed(2)}ms`);
              }
            })
            .catch(err => {
              console.error(err.message);
            });
        });
      }
    } else {
      util.assertCompilationResult(results, cliOptions.quiet);
      await output(results.values());
    }
  }

  async function stdin() {
    let code = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
      code += chunk;
    }
    const res = await util.transform(
      cliOptions.filename,
      code,
      {
        ...swcOptions,
        sourceFileName: "stdin",
      },
      cliOptions.sync,
      undefined
    );

    output([res]);
  }

  if (cliOptions.filenames.length) {
    await files();
  } else {
    await stdin();
  }
}
