import glob from "fast-glob";
import slash from "slash";
import { stat } from 'fs';
import { join, basename, extname } from "path";

/**
 * Find all input files based on source globs
 */
export async function globSources(
  sources: string[],
  includeDotfiles = false
): Promise<string[]> {
  const globConfig = {
    dot: includeDotfiles,
    nodir: true,
  };

  const files = await Promise.all(
    sources
      .filter(source => includeDotfiles || !basename(source).startsWith("."))
      .map((source) => {
        return new Promise<string[]>(resolve => {
          stat(source, (err, stat) => {
            if (err) {
              resolve([]);
              return;
            }
            if (!stat.isDirectory()) {
              resolve([source])
            } else {
              glob(slash(join(source, "**")), globConfig)
                .then((matches) => resolve(matches))
                .catch(() => resolve([]))
            }
          });
        });
      })
  );

  return Array.from(new Set<string>(files.flat()));
}

type Split = [
  compilable: string[],
  copyable: string[]
]

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
    const isCompilable = allowedExtension.includes(extname(file))

    if (isCompilable) {
      compilable.push(file)
    } else if (copyFiles) {
      copyable.push(file)
    }
  }

  return [compilable, copyable];
}

