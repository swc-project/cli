import slash from "slash";
import { promises } from "fs";
import { dirname, relative, join } from "path";
import { globSources, slitCompilableAndCopyable } from './sources'
import { CompileStatus } from "./constants";
import { CliOptions } from "./options";
import { compile } from "./util";
import { outputResult } from "./compile";
import type { Options } from "@swc/core";

const {
  mkdir,
  rmdir,
  copyFile,
} = promises;

const cwd = process.cwd();
const recursive = { recursive: true }


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

function getDest(filename: string, outDir: string, ext?: string) {
  const relativePath = slash(relative(cwd, filename));
  let base = stripComponents(relativePath);
  if (ext) {
    base = base.replace(/\.\w*$/, ext);
  }
  return join(outDir, base);
}

export default async function ({
  cliOptions,
  swcOptions
}: {
  cliOptions: CliOptions;
  swcOptions: Options;
}) {
  const {
    includeDotfiles,
    filenames,
    copyFiles,
    extensions,
    outDir,
    sync,
    deleteDirOnStart
  } = cliOptions;

  async function handleCompile(filename: string) {
    const dest = getDest(filename, outDir, ".js");
    const sourceFileName = slash(relative(dirname(dest), filename));

    const options = { sourceFileName, ...swcOptions }

    const result = await compile(
      filename,
      options,
      sync
    );

    if (result) {
      await outputResult(result, filename, dest, options);
      return CompileStatus.Compiled;
    } else {
      return CompileStatus.Omitted;
    }
  }

  async function handleCopy(filename: string) {
    const dest = getDest(filename, outDir);
    const dir = dirname(dest);

    await mkdir(dir, recursive);
    await copyFile(filename, dest);

    return CompileStatus.Copied;
  }

  if (deleteDirOnStart) {
    console.log('clean dir1')
    await rmdir(cliOptions.outDir, recursive)
  }

  const results = new Map<string, CompileStatus>();

  console.time("Compilation")
  const sourceFiles = await globSources(filenames, includeDotfiles)
  const [
    compilable,
    copyable
  ] = slitCompilableAndCopyable(sourceFiles, extensions, copyFiles)

  await mkdir(cliOptions.outDir, recursive);

  if (sync) {
    for (const filename of compilable) {
      try {
        const result = await handleCompile(filename);
        results.set(filename, result);
      } catch (err) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
    for (const filename of copyable) {
      try {
        const result = await handleCopy(filename);
        results.set(filename, result);
      } catch (err) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
  } else {
    await Promise.all([
      Promise.allSettled(compilable.map(file => handleCompile(file))),
      Promise.allSettled(copyable.map(file => handleCopy(file)))
    ]).then(([compiled, copied]) => {
      compiled.forEach((result, index) => {
        const filename = compilable[index];
        if (result.status === "fulfilled") {
          results.set(filename, result.value);
        } else {
          results.set(filename, CompileStatus.Failed);
        }
      });

      copied.forEach((result, index) => {
        const filename = copyable[index];
        if (result.status === "fulfilled") {
          results.set(filename, result.value);
        } else {
          results.set(filename, CompileStatus.Failed);
        }
      });
    });
  }


  let failed = 0;
  let compiled = 0;
  let omitted = 0;
  let copied = 0;
  for (let [_, status] of results) {
    switch (status) {
      case CompileStatus.Compiled:
        compiled += 1;
        break;
      case CompileStatus.Failed:
        failed += 1;
        break;
      case CompileStatus.Copied:
        copied += 1;
        break;
      case CompileStatus.Omitted:
        omitted += 1;
        break;
    }
  }
  console.timeEnd("Compilation")
  console.log(`
  failed: ${failed}
  compiled: ${compiled}
  copied: ${copied}
  omitted: ${omitted}
  `)
}
