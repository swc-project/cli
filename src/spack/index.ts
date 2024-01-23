import { bundle } from "@swc/core";
import { mkdir, writeFile } from "fs";
import { basename, dirname, extname, join, relative } from "path";
import { promisify } from "util";

import parseSpackArgs from "./options";

const write = promisify(writeFile);
const makeDir = promisify(mkdir);

(async () => {
  const { spackOptions } = await parseSpackArgs(process.argv);

  function isUserDefinedEntry(name: string) {
    if (typeof spackOptions.entry === "string") {
      return spackOptions.entry === name;
    }
    if (Array.isArray(spackOptions.entry)) {
      for (const e of spackOptions.entry) {
        if (e === name) {
          return true;
        }
      }
      return false;
    }

    return name in spackOptions.entry;
  }

  async function build() {
    const bundleStart = process.hrtime();
    const output = await bundle(spackOptions);
    const bundleEnd = process.hrtime(bundleStart);
    console.info(`Bundling done: ${bundleEnd[0]}s ${bundleEnd[1] / 1000000}ms`);

    const emitStart = process.hrtime();
    if (spackOptions.output?.path) {
      await Object.keys(output).map(async name => {
        let fullPath = "";
        if (isUserDefinedEntry(name)) {
          fullPath = join(
            spackOptions.output.path,
            spackOptions.output.name.replace("[name]", name)
          );
        } else {
          const ext = extname(name);
          const base = basename(name, ext);
          const filename = relative(process.cwd(), name);
          fullPath = join(
            spackOptions.output.path,
            dirname(filename),
            `${base}.js`
          );
        }

        await makeDir(dirname(fullPath), { recursive: true });
        await write(fullPath, output[name].code, "utf-8");
        if (output[name].map) {
          await write(`${fullPath}.map`, output[name].map!, "utf-8");
        }
      });
    } else {
      throw new Error("Cannot print to stdout: not implemented yet");
    }
    const emitEnd = process.hrtime(emitStart);
    console.info(`Done: ${emitEnd[0]}s ${emitEnd[1] / 1000000}ms`);
  }

  // if (cliOptions.watch) {
  //     throw new Error('watch is not implemented yet')
  // }

  await build();
})();
