import slash from 'slash';
import { promises } from "fs";
import { dirname, relative } from "path";
import { transformFile, transformFileSync } from "@swc/core";
import type { Options, Output } from "@swc/core";

const {
  mkdir,
  stat,
  writeFile
} = promises;

function getSourceMap(output: Output, options: Options, destFile: string) {
  if (!output.map || !options.sourceMaps || options.sourceMaps === "inline") {
    return {
      sourceCode: output.code,
    }
  }
  const sourceMap = JSON.parse(output.map);
  if (options.sourceFileName) {
    sourceMap['sources'][0] = options.sourceFileName;
  }
  if (options.sourceRoot) {
    sourceMap['sourceRoot'] = options.sourceRoot;
  }
  output.map = JSON.stringify(sourceMap);

  const fileDirName = dirname(destFile);
  const mapLoc = destFile + ".map";
  output.code += `\n//# sourceMappingURL=${slash(relative(fileDirName, mapLoc))}`;

  return {
    sourceMap: output.map,
    sourceMapPath: mapLoc,
    sourceCode: output.code
  }
}

export async function outputResult(
  output: Output,
  sourceFile: string,
  destFile: string,
  options: Options
) {
  const destDir = dirname(destFile);

  const {
    sourceMap,
    sourceMapPath,
    sourceCode
  } = getSourceMap(output, options, destFile);

  await mkdir(destDir, { recursive: true });
  const { mode } = await stat(sourceFile);

  if (!sourceMapPath) {
    await writeFile(destFile, sourceCode, { mode });
  } else {
    await Promise.all([
      writeFile(destFile, sourceCode, { mode }),
      writeFile(sourceMapPath, sourceMap, { mode })
    ]);
  }
}


export async function compile(
  filename: string,
  opts: Options,
  sync: boolean
): Promise<Output | void> {
  try {
    const result = sync
      ? transformFileSync(filename, opts)
      : await transformFile(filename, opts);

    return result;
  } catch (err) {
    if (!err.message.includes("ignored by .swcrc")) {
      throw err;
    }
  }
}
