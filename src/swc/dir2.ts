import slash from "slash";
import { promises } from "fs";
import { dirname, relative, join } from "path";
import { CompileStatus } from "./constants";
import { CliOptions } from "./options";
import { compile } from "./util";
import { outputResult } from "./compile";
import {
  globSources,
  isCompilableExtension,
  slitCompilableAndCopyable,
  watchSources
} from './sources'

import type { Options } from "@swc/core";

const {
  mkdir,
  rmdir,
  copyFile,
  unlink,
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

async function handleCompile(filename: string, outDir: string, sync: boolean, swcOptions: Options) {
  const dest = getDest(filename, outDir, ".js");
  const sourceFileName = slash(relative(dirname(dest), filename));

  const options = { ...swcOptions, sourceFileName }

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

async function handleCopy(filename: string, outDir: string) {
  const dest = getDest(filename, outDir);
  const dir = dirname(dest);

  await mkdir(dir, recursive);
  await copyFile(filename, dest);

  return CompileStatus.Copied;
}


async function beforeStartCompilation(cliOptions: CliOptions) {
  const {
    outDir,
    deleteDirOnStart
  } = cliOptions

  if (deleteDirOnStart) {
    await rmdir(outDir, recursive);
  }
}

async function initialCompilation(cliOptions: CliOptions, swcOptions: Options) {
  const {
    includeDotfiles,
    filenames,
    copyFiles,
    extensions,
    outDir,
    sync,
  } = cliOptions;
  const results = new Map<string, CompileStatus>();

  const sourceFiles = await globSources(filenames, includeDotfiles)
  const [
    compilable,
    copyable
  ] = slitCompilableAndCopyable(sourceFiles, extensions, copyFiles)

  if (sync) {
    for (const filename of compilable) {
      try {
        const result = await handleCompile(filename, outDir, sync, swcOptions);
        results.set(filename, result);
      } catch (err) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
    for (const filename of copyable) {
      try {
        const result = await handleCopy(filename, outDir);
        results.set(filename, result);
      } catch (err) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
  } else {
    await Promise.all([
      Promise.allSettled(compilable.map(file => handleCompile(file, outDir, sync, swcOptions))),
      Promise.allSettled(copyable.map(file => handleCopy(file, outDir)))
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


async function watchCompilation(cliOptions: CliOptions, swcOptions: Options) {
  const {
    includeDotfiles,
    filenames,
    copyFiles,
    extensions,
    outDir,
    quiet,
    sync,
    logWatchCompilation
  } = cliOptions;

  const watcher = await watchSources(filenames, includeDotfiles);
  watcher.on('ready', () => {
    if (!quiet) {
      console.info('Watching for file changes.')
    }
  });
  watcher.on('unlink', async (filename) => {
    try {
      if (isCompilableExtension(filename, extensions)) {
        await unlink(getDest(filename, outDir, ".js"));
      } else if (copyFiles) {
        await unlink(getDest(filename, outDir));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(err.stack);
      }
    }
  });
  for (const type of ['add', 'change']) {
    watcher.on(type, async (filename) => {
      if (isCompilableExtension(filename, extensions)) {
        try {
          const result = await handleCompile(filename, outDir, sync, swcOptions);
          if (logWatchCompilation) {

          }
        } catch (err) {
          if (logWatchCompilation) {

          }
        }
      } else if (copyFiles) {
        try {
          const result = await handleCopy(filename, outDir);
          if (logWatchCompilation) {

          }
        } catch (err) {
          if (logWatchCompilation) {

          }
        }
      }
    });
  }
}

export default async function ({
  cliOptions,
  swcOptions
}: {
  cliOptions: CliOptions;
  swcOptions: Options;
}) {
  const {
    watch,
  } = cliOptions;

  await beforeStartCompilation(cliOptions);
  await initialCompilation(cliOptions, swcOptions);

  if (watch) {
    await watchCompilation(cliOptions, swcOptions);
  }
}
