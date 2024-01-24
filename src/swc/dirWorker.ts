import slash from "slash";
import { dirname, relative } from "path";
import { CompileStatus } from "./constants";
import { compile, getDest } from "./util";
import { outputResult } from "./compile";

import type { Options } from "@swc/core";

export default async function handleCompile(opts: {
  filename: string;
  outDir: string;
  sync: boolean;
  swcOptions: Options;
}) {
  const dest = getDest(opts.filename, opts.outDir, ".js");
  const sourceFileName = slash(relative(dirname(dest), opts.filename));

  const options = { ...opts.swcOptions, sourceFileName };

  const result = await compile(opts.filename, options, opts.sync, dest);

  if (result) {
    await outputResult(result, opts.filename, dest, options);
    return CompileStatus.Compiled;
  } else {
    return CompileStatus.Omitted;
  }
}
