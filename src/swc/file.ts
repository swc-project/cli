import swc from "@swc/core";
import convertSourceMap from "convert-source-map";
import fs from "fs";
import defaults from "lodash/defaults";
import path from "path";
import slash from "slash";
import sourceMap, { SourceMapGenerator } from "source-map";

import { CliOptions } from "./options";
import * as util from "./util";

export default async function ({
  cliOptions,
  swcOptions
}: {
  cliOptions: CliOptions;
  swcOptions: swc.Options;
}) {
  async function buildResult(
    fileResults: (swc.Output | null)[]
  ): Promise<{
    code: string;
    map: SourceMapGenerator;
  }> {
    const map = new sourceMap.SourceMapGenerator({
      file:
        cliOptions.sourceMapTarget ||
        path.basename(cliOptions.outFile || "") ||
        "stdout",
      sourceRoot: swcOptions.sourceRoot
    });

    let code = "";
    let offset = 0;

    for (const result of fileResults) {
      if (!result) continue;

      code += result.code + "\n";

      if (result.map) {
        const consumer = await new sourceMap.SourceMapConsumer(result.map);
        const sources = new Set();

        consumer.eachMapping(function (mapping: any) {
          if (mapping.source != null) sources.add(mapping.source);

          map.addMapping({
            generated: {
              line: mapping.generatedLine + offset,
              column: mapping.generatedColumn
            },
            source: mapping.source,
            // @ts-expect-error
            original:
              mapping.source == null
                ? null
                : {
                  line: mapping.originalLine,
                  column: mapping.originalColumn
                }
          });
        });

        sources.forEach(source => {
          const content = consumer.sourceContentFor(source as any, true);
          if (content !== null) {
            map.setSourceContent(source as any, content);
          }
        });

        offset = code.split("\n").length - 1;
      }
    }

    // add the inline sourcemap comment if we've either explicitly asked for inline source
    // maps, or we've requested them without any output file
    if (
      swcOptions.sourceMaps === "inline" ||
      (!cliOptions.outFile && swcOptions.sourceMaps)
    ) {
      code += "\n" + convertSourceMap.fromObject(map).toComment();
    }

    return {
      map: map,
      code: code
    };
  }

  async function output(fileResults: (swc.Output | null)[]): Promise<void> {
    const result = await buildResult(fileResults);

    if (cliOptions.outFile) {
      // we've requested for a sourcemap to be written to disk
      if (swcOptions.sourceMaps && swcOptions.sourceMaps !== "inline") {
        const mapLoc = cliOptions.outFile + ".map";
        result.code = util.addSourceMappingUrl(result.code, mapLoc);
        fs.writeFileSync(mapLoc, JSON.stringify(result.map));
      }

      fs.writeFileSync(cliOptions.outFile, result.code);
    } else {
      process.stdout.write(result.code + "\n");
    }
  }

  function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let code = "";

      process.stdin.setEncoding("utf8");

      process.stdin.on("readable", function () {
        const chunk = process.stdin.read();
        if (chunk !== null) code += chunk;
      });

      process.stdin.on("end", function () {
        resolve(code);
      });
      process.stdin.on("error", reject);
    });
  }

  async function stdin() {
    const code = await readStdin();

    const res = await util.transform(
      cliOptions.filename,
      code,
      defaults(
        {
          sourceFileName: "stdin"
        },
        swcOptions
      ),
      cliOptions.sync
    );

    output([res]);
  }

  async function walk(filenames: string[]) {
    const _filenames: string[] = [];

    filenames.forEach(function (filename) {
      if (!fs.existsSync(filename)) return;

      const stat = fs.statSync(filename);
      if (stat.isDirectory()) {
        const dirname = filename;

        util
          .readdirForCompilable(
            filename,
            cliOptions.includeDotfiles,
            cliOptions.extensions
          )
          .forEach(function (filename: string) {
            _filenames.push(path.join(dirname, filename));
          });
      } else {
        _filenames.push(filename);
      }
    });

    const results = await Promise.all(
      _filenames.map(async function (filename) {
        let sourceFileName = filename;
        if (cliOptions.outFile) {
          sourceFileName = path.relative(
            path.dirname(cliOptions.outFile),
            sourceFileName
          );
        }
        sourceFileName = slash(sourceFileName);

        try {
          return await util.compile(
            filename,
            defaults(
              {
                sourceFileName,
                // Since we're compiling everything to be merged together,
                // "inline" applies to the final output file, but to the individual
                // files being concatenated.
                sourceMaps:
                  swcOptions.sourceMaps === "inline"
                    ? true
                    : swcOptions.sourceMaps
              },
              swcOptions
            ),
            cliOptions.sync
          );
        } catch (err) {
          if (!cliOptions.watch) {
            throw err;
          }

          console.error(err);
          return null;
        }
      })
    );

    output(results);
  }

  async function files(filenames: string[]) {
    await walk(filenames);

    if (cliOptions.watch) {
      const chokidar = util.requireChokidar();
      chokidar
        .watch(filenames, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 50,
            pollInterval: 10
          }
        })
        .on("all", function (type: string, filename: string) {
          if (!util.isCompilableExtension(filename, cliOptions.extensions)) {
            return;
          }

          if (type === "add" || type === "change") {
            if (cliOptions.verbose) {
              console.log(type + " " + filename);
            }

            walk(filenames).catch(err => {
              console.error(err);
            });
          }
        });
    }
  }

  if (cliOptions.filenames.length) {
    await files(cliOptions.filenames);
  } else {
    await stdin();
  }
}
