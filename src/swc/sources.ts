import glob from "fast-glob";
import micromatch from "micromatch";
import slash from "slash";
import { stat } from "fs";
import { join, basename, extname } from "path";
import { CliOptions } from "./options";

type GlobSourcesOptions = Partial<
  Pick<CliOptions, "includeDotfiles" | "ignorePatterns" | "onlyPatterns">
>;

/**
 * Find all input files based on source globs
 */
export async function globSources(
  sources: string[],
  options: GlobSourcesOptions = {}
): Promise<string[]> {
  const {
    includeDotfiles = false,
    ignorePatterns = [],
    onlyPatterns = [],
  } = options;
  const globConfig = {
    dot: includeDotfiles,
    ignore: ignorePatterns,
  };

  const files = await Promise.all(
    sources
      .filter(source => includeDotfiles || !basename(source).startsWith("."))
      .map(source => {
        return new Promise<string[]>(resolve => {
          stat(source, async (err, stat) => {
            if (err) {
              resolve([]);
              return;
            }
            if (!stat.isDirectory()) {
              resolve(
                micromatch(
                  [source],
                  onlyPatterns.length ? onlyPatterns : ["**/*"],
                  globConfig
                )
              );
            } else {
              try {
                const matches = await glob(
                  slash(join(source, "**")),
                  globConfig
                );
                const finalMatches = onlyPatterns.length
                  ? micromatch(matches, onlyPatterns, globConfig)
                  : matches;

                resolve(finalMatches);
              } catch (err) {
                resolve([]);
              }
            }
          });
        });
      })
  );

  return Array.from(new Set<string>(files.flat()));
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
export function slitCompilableAndCopyable(
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

export async function watchSources(
  sources: string[],
  options: GlobSourcesOptions = {}
) {
  const {
    includeDotfiles = false,
    ignorePatterns = [],
    onlyPatterns = [],
  } = options;
  const globConfig = {
    dot: includeDotfiles,
  };
  const chokidar = await requireChokidar();

  return chokidar.watch(sources, {
    ignored: [
      !includeDotfiles &&
        ((filename: string) => basename(filename).startsWith(".")),
      ...ignorePatterns,
      onlyPatterns.length &&
        ((filename: string) =>
          !micromatch.isMatch(filename, onlyPatterns, globConfig)),
    ].filter(Boolean),
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });
}
