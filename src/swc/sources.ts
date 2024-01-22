import glob from "fast-glob";
import slash from "slash";
import { stat } from "fs";
import { join, basename, extname } from "path";
import { minimatch } from "minimatch";

/**
 * Find all input files based on source globs
 */
export async function globSources(
  sources: string[],
  only: string[],
  ignore: string[],
  includeDotfiles = false
): Promise<string[]> {
  const globConfig: glob.Options = {
    dot: includeDotfiles,
    ignore,
  };

  const files = await Promise.all(
    sources
      .filter(
        source =>
          includeDotfiles || source === "." || !basename(source).startsWith(".")
      )
      .map(source => {
        return new Promise<string[]>(resolve => {
          stat(source, (err, stat) => {
            if (err) {
              resolve([]);
              return;
            }
            if (!stat.isDirectory()) {
              resolve([source]);
            } else {
              glob(slash(join(source, "**")), globConfig)
                .then(matches => resolve(matches))
                .catch(() => resolve([]));
            }
          });
        });
      })
  );

  const f = files.flat().filter(filename => {
    return (
      !only ||
      only.length === 0 ||
      only.some(only => minimatch(slash(filename), only))
    );
  });

  return Array.from(new Set<string>(f));
}

type Split = [compilable: string[], copyable: string[]];

/**
 * Test if a filename ends with a compilable extension.
 */
export function isCompilableExtension(
  filename: string,
  allowedExtension: string[]
): boolean {
  const ext = extname(filename);
  return allowedExtension.includes(ext);
}

/**
 * Split file list to files that can be compiled and copied
 */
export function splitCompilableAndCopyable(
  files: string[],
  allowedExtension: string[],
  copyFiles: boolean
): Split {
  const compilable: string[] = [];
  const copyable: string[] = [];

  for (const file of files) {
    const isCompilable = isCompilableExtension(file, allowedExtension);

    if (isCompilable) {
      compilable.push(file);
    } else if (copyFiles) {
      copyable.push(file);
    }
  }

  return [compilable, copyable];
}

export async function requireChokidar() {
  try {
    const { default: chokidar } = await import("chokidar");
    return chokidar;
  } catch (err) {
    console.error(
      "The optional dependency chokidar is not installed and is required for " +
        "--watch. Chokidar is likely not supported on your platform."
    );
    throw err;
  }
}

export async function watchSources(sources: string[], includeDotfiles = false) {
  const chokidar = await requireChokidar();

  return chokidar.watch(sources, {
    ignored: includeDotfiles
      ? undefined
      : (filename: string) => basename(filename).startsWith("."),
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });
}
