import slash from "slash";
import { promises } from "fs";
import { dirname, relative } from "path";
import { transformFile, transformFileSync } from "@swc/core";
import type { Options, Output } from "@swc/core";

const { mkdir, stat, writeFile } = promises;

function withSourceMap(
  output: Output,
  options: Options,
  destFile: string,
  destDir: string
) {
  if (!output.map || options.sourceMaps === "inline") {
    return {
      sourceCode: output.code,
    };
  }
  // TODO: remove once fixed in core https://github.com/swc-project/swc/issues/1388
  const sourceMap = JSON.parse(output.map);
  if (options.sourceFileName) {
    sourceMap["sources"][0] = options.sourceFileName;
  }
  if (options.sourceRoot) {
    sourceMap["sourceRoot"] = options.sourceRoot;
  }
  output.map = JSON.stringify(sourceMap);

  const sourceMapPath = destFile + ".map";
  output.code += `\n//# sourceMappingURL=${slash(
    relative(destDir, sourceMapPath)
  )}`;

  return {
    sourceMap: output.map,
    sourceMapPath,
    sourceCode: output.code,
  };
}

export async function outputResult(
  output: Output,
  sourceFile: string,
  destFile: string,
  options: Options
) {
  const destDir = dirname(destFile);

  const { sourceMap, sourceMapPath, sourceCode } = withSourceMap(
    output,
    options,
    destFile,
    destDir
  );

  await mkdir(destDir, { recursive: true });
  const { mode } = await stat(sourceFile);

  if (!sourceMapPath) {
    await writeFile(destFile, sourceCode, { mode });
  } else {
    await Promise.all([
      writeFile(destFile, sourceCode, { mode }),
      writeFile(sourceMapPath, sourceMap!, { mode }),
    ]);
  }
}

export async function compile(
  filename: string,
  opts: Options,
  sync: boolean,
  outputPath: string | undefined
): Promise<Output | void> {
  const options = { ...opts };
  if (outputPath) {
    options.outputPath = outputPath;
  }

  try {
    const result = sync
      ? transformFileSync(filename, options)
      : await transformFile(filename, options);

    return result;
  } catch (err: any) {
    if (!err.message.includes("ignored by .swcrc")) {
      throw err;
    }
  }
}
