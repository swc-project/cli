import slash from "slash";
import { dirname, relative } from "path";
import { CompileStatus } from "./constants";
import { compile, getDest } from "./util";
import { outputResult } from "./compile";

import type { Options } from "@swc/core";
import type { CliOptions } from "./options";
import { DEFAULT_OUT_FILE_EXTENSION } from "./options";

export default async function handleCompile(opts: {
  filename: string;
  outDir: string;
  sync: boolean;
  cliOptions: CliOptions;
  swcOptions: Options;
  outFileExtension?: string;
}) {
  const dest = getDest(
    opts.filename,
    opts.outDir,
    opts.cliOptions.stripLeadingPaths,
    `.${opts.outFileExtension ?? DEFAULT_OUT_FILE_EXTENSION}`
  );
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
