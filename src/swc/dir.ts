import slash from "slash";
import { existsSync, promises } from "fs";
import { dirname, relative, join, isAbsolute, resolve } from "path";
import { CompileStatus } from "./constants";
import { CliOptions } from "./options";
import { compile } from "./util";
import { outputResult } from "./compile";
import {
  globSources,
  isCompilableExtension,
  slitCompilableAndCopyable,
  watchSources,
} from "./sources";
import { FileContext } from "./file";

import type { Options } from "@swc/core";

declare module "fs" {
  namespace promises {
    /**
     * For node > 14 we want to use rm instead of rmdir
     * We need to augment node v12 types
     */
    function rm(dir: string, option: object): void;
  }
}

const { mkdir, rmdir, rm, copyFile, unlink } = promises;

const recursive = { recursive: true };

function getDest(
  filename: string,
  sourceLength: number,
  cwd: string,
  outDir: string,
  ext?: string
) {
  const outDirAbsolutePath = slash(resolve(cwd, outDir));
  let relativePath = slash(filename.slice(sourceLength));

  if (ext) {
    relativePath = relativePath.replace(/\.\w*$/, ext);
  }
  return join(outDirAbsolutePath, relativePath);
}

async function handleCompile(
  filename: string,
  sourceLength: number,
  cwd: string,
  outDir: string,
  sync: boolean,
  swcOptions: Options
) {
  const dest = getDest(filename, sourceLength, cwd, outDir, ".js");
  const sourceFileName = slash(relative(dirname(dest), filename));

  const options = { ...swcOptions, sourceFileName };

  const result = await compile(filename, options, sync, dest);

  if (result) {
    await outputResult(result, filename, dest, options);
    return CompileStatus.Compiled;
  } else {
    return CompileStatus.Omitted;
  }
}

async function handleCopy(
  filename: string,
  sourceLength: number,
  cwd: string,
  outDir: string
) {
  const dest = getDest(filename, sourceLength, cwd, outDir);
  const dir = dirname(dest);

  await mkdir(dir, recursive);
  await copyFile(filename, dest);

  return CompileStatus.Copied;
}

async function beforeStartCompilation(cliOptions: CliOptions) {
  const { outDir, deleteDirOnStart } = cliOptions;

  if (deleteDirOnStart) {
    const exists = await existsSync(outDir);
    if (exists) {
      rm ? await rm(outDir, recursive) : await rmdir(outDir, recursive);
    }
  }
}

function absolutePath(filenames: string[], cwd: string): string[] {
  return filenames.map((filename: string) => {
    if (!isAbsolute(filename)) {
      filename = resolve(cwd, filename);
    }
    return filename;
  });
}

function resolveCwd(cwd: string): string {
  return cwd ?? process.cwd();
}

async function initialCompilation(
  cliOptions: CliOptions,
  swcOptions: Options
): Promise<FileContext> {
  const {
    includeDotfiles,
    filenames,
    copyFiles,
    extensions,
    cwd,
    outDir,
    sync,
    quiet,
    watch,
  } = cliOptions;

  const results = new Map<string, CompileStatus>();

  const start = process.hrtime();
  const resolvedCwd = resolveCwd(cwd);
  const filenamesAbsolutePath = absolutePath(filenames, resolvedCwd);
  const [sourceFiles, fileContext] = await globSources(
    filenamesAbsolutePath,
    includeDotfiles
  );
  const [compilable, copyable] = slitCompilableAndCopyable(
    sourceFiles,
    extensions,
    copyFiles
  );

  if (sync) {
    for (const filename of compilable) {
      try {
        const result = await handleCompile(
          filename,
          fileContext[filename],
          resolvedCwd,
          outDir,
          sync,
          swcOptions
        );
        results.set(filename, result);
      } catch (err: any) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
    for (const filename of copyable) {
      try {
        const result = await handleCopy(
          filename,
          fileContext[filename],
          resolvedCwd,
          outDir
        );
        results.set(filename, result);
      } catch (err: any) {
        console.error(err.message);
        results.set(filename, CompileStatus.Failed);
      }
    }
  } else {
    await Promise.all([
      Promise.allSettled(
        compilable.map(file =>
          handleCompile(
            file,
            fileContext[file],
            resolvedCwd,
            outDir,
            sync,
            swcOptions
          ).catch(err => {
            console.error(err.message);
            throw err;
          })
        )
      ),
      Promise.allSettled(
        copyable.map(file =>
          handleCopy(file, fileContext[file], resolvedCwd, outDir)
        )
      ),
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
  const end = process.hrtime(start);

  let failed = 0;
  let compiled = 0;
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
    }
  }

  if (!quiet && compiled + copied) {
    let message = "";
    if (compiled) {
      message += `Successfully compiled: ${compiled} ${
        compiled > 1 ? "files" : "file"
      }`;
    }
    if (compiled && copied) {
      message += ", ";
    }
    if (copied) {
      message += `copied ${copied} ${copied > 1 ? "files" : "file"}`;
    }
    message += ` with swc (%dms)`;

    console.log(message, (end[1] / 1000000).toFixed(2));
  }

  if (failed) {
    console.log(
      `Failed to compile ${failed} ${failed !== 1 ? "files" : "file"} with swc.`
    );
    if (!watch) {
      const files = Array.from(results.entries())
        .filter(([, status]) => status === CompileStatus.Failed)
        .map(([filename, _]) => filename)
        .join("\n");
      throw new Error(`Failed to compile:\n${files}`);
    }
  }

  return fileContext;
}

async function watchCompilation(
  cliOptions: CliOptions,
  swcOptions: Options,
  fileContext: FileContext
) {
  const {
    cwd,
    includeDotfiles,
    filenames,
    copyFiles,
    extensions,
    outDir,
    quiet,
    sync,
  } = cliOptions;

  const resolvedCwd = resolveCwd(cwd);
  const filenamesAbsolutePath = absolutePath(filenames, resolvedCwd);
  const watcher = await watchSources(filenamesAbsolutePath, includeDotfiles);
  watcher.on("ready", () => {
    if (!quiet) {
      console.info("Watching for file changes.");
    }
  });
  watcher.on("unlink", async filename => {
    try {
      if (isCompilableExtension(filename, extensions)) {
        await unlink(
          getDest(filename, fileContext[filename], resolvedCwd, outDir, ".js")
        );
      } else if (copyFiles) {
        await unlink(
          getDest(filename, fileContext[filename], resolvedCwd, outDir)
        );
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error(err.stack);
      }
    }
  });
  for (const type of ["add", "change"]) {
    watcher.on(type, async filename => {
      if (isCompilableExtension(filename, extensions)) {
        try {
          const start = process.hrtime();
          const result = await handleCompile(
            filename,
            fileContext[filename],
            resolvedCwd,
            outDir,
            sync,
            swcOptions
          );
          if (!quiet && result === CompileStatus.Compiled) {
            const end = process.hrtime(start);
            console.log(
              `Successfully compiled ${filename} with swc (%dms)`,
              (end[1] / 1000000).toFixed(2)
            );
          }
        } catch (err: any) {
          console.error(err.message);
        }
      } else if (copyFiles) {
        try {
          const start = process.hrtime();
          const result = await handleCopy(
            filename,
            fileContext[filename],
            resolvedCwd,
            outDir
          );
          if (!quiet && result === CompileStatus.Copied) {
            const end = process.hrtime(start);
            console.log(
              `Successfully copied ${filename} with swc (%dms)`,
              (end[1] / 1000000).toFixed(2)
            );
          }
        } catch (err: any) {
          console.error(`Failed to copy ${filename}`);
          console.error(err.message);
        }
      }
    });
  }
}

export default async function dir({
  cliOptions,
  swcOptions,
}: {
  cliOptions: CliOptions;
  swcOptions: Options;
}) {
  const { watch } = cliOptions;

  await beforeStartCompilation(cliOptions);
  const fileContext = await initialCompilation(cliOptions, swcOptions);

  if (watch) {
    await watchCompilation(cliOptions, swcOptions, fileContext);
  }
}
