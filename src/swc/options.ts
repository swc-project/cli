import { Options, version as swcCoreVersion } from "@swc/core";
import commander from "commander";
import { set } from "lodash";

const pkg = require("../../package.json");

// Standard swc input configs.
commander.option(
  "-f, --filename [filename]",
  "filename to use when reading from stdin - this will be used in source-maps, errors etc"
);

commander.option("--config-file [path]", "Path to a .swcrc file to use");
commander.option(
  "--env-name [name]",
  "The name of the 'env' to use when loading configs and plugins. " +
  "Defaults to the value of SWC_ENV, or else NODE_ENV, or else 'development'."
);

// commander.option(
//     "--typescript",
//     "Treat input as typescript",
// );

// Basic file input configuration.
commander.option("--no-swcrc", "Whether or not to look up .swcrc files");

commander.option(
  "--ignore [list]",
  "list of glob paths to **not** compile",
  collect
);
commander.option(
  "--only [list]",
  "list of glob paths to **only** compile",
  collect
);

commander.option("-w, --watch", "Recompile files on changes");

commander.option("-q, --quiet", "Suppress compilation output");

// General source map formatting.
commander.option("-s, --source-maps [true|false|inline|both]", "generate source maps", unstringify);
commander.option(
  "--source-map-target [string]",
  "set `file` on returned source map"
);
commander.option(
  "--source-file-name [string]",
  "set `sources[0]` on returned source map"
);
commander.option(
  "--source-root [filename]",
  "the root from which all sources are relative"
);

commander.option(
  "-o, --out-file [out]",
  "Compile all input files into a single file"
);
commander.option(
  "-d, --out-dir [out]",
  "Compile an input directory of modules into an output directory"
);

commander.option(
  "-D, --copy-files",
  "When compiling a directory copy over non-compilable files"
);
commander.option(
  "--include-dotfiles",
  "Include dotfiles when compiling and copying non-compilable files"
);

commander.option(
  "-C, --config <config>",
  "Override a config from .swcrc file. e.g. -C module.type=amd -C module.moduleId=hello",
  collect
);

commander.option(
  "--sync",
  "Invoke swc synchronously. Useful for debugging.",
  collect
);

commander.option(
  "--log-watch-compilation",
  "Log a message when a watched file is successfully compiled"
);


commander.option(
  "--extensions [list]",
  "Use specific extensions",
  collect
);

commander.version(
  `@swc/cli: ${pkg.version}
@swc/core: ${swcCoreVersion}`
);

commander.usage("[options] <files ...>");

function unstringify(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function collect(value: string, previousValue?: string[]): string[] | undefined {
  // If the user passed the option with no value, like "babel file.js --presets", do nothing.
  if (typeof value !== "string") return previousValue;

  const values = value.split(",");

  return previousValue ? previousValue.concat(values) : values;
}

export interface CliOptions {
  readonly outDir: string;
  readonly outFile: string;
  /**
   * Invoke swc using transformSync. It's useful for debugging.
   */
  readonly sync: boolean;

  readonly sourceMapTarget: string;

  readonly filename: string;
  readonly filenames: string[];
  readonly extensions: string[];
  readonly keepFileExtension: boolean;
  readonly verbose: boolean;
  readonly watch: boolean;
  readonly relative: boolean;
  readonly copyFiles: boolean;
  readonly includeDotfiles: boolean;
  readonly deleteDirOnStart: boolean;
  readonly quiet: boolean;
  readonly logWatchCompilation: boolean;
}

export default function parserArgs(args: string[]) {
  commander.parse(args);
  const opts = commander.opts();

  const filenames = commander.args;
  const errors = [];

  if (opts.outDir && !filenames.length) {
    errors.push("--out-dir requires filenames");
  }

  if (opts.outFile && opts.outDir) {
    errors.push("--out-file and --out-dir cannot be used together");
  }

  if (opts.watch) {
    if (!opts.outFile && !opts.outDir) {
      errors.push("--watch requires --out-file or --out-dir");
    }

    if (!filenames.length) {
      errors.push("--watch requires filenames");
    }
  } else if (opts.logWatchCompilation) {
    errors.push("--log-watch-compilation requires --watch")
  }

  if (
    !opts.outDir &&
    filenames.length === 0 &&
    typeof opts.filename !== "string" &&
    opts.swcrc !== false
  ) {
    errors.push(
      "stdin compilation requires either -f/--filename [filename] or --no-swcrc"
    );
  }

  if (errors.length) {
    console.error("swc:");
    for (const error of errors) {
      console.error("  " + error);
    }
    process.exit(2);
  }

  const swcOptions: Options = {
    jsc: {
      parser: undefined,
      transform: {}
    },
    // filename,
    sourceMaps: opts.sourceMaps,
    sourceFileName: opts.sourceFileName,
    sourceRoot: opts.sourceRoot,
    configFile: opts.configFile
  };

  if (opts.config) {
    for (const cfg of opts.config as string[]) {
      const i = cfg.indexOf("=");
      let key: string;
      let value: any;
      if (i === -1) {
        key = cfg;
        value = true;
      } else {
        key = cfg.substring(0, i);
        value = unstringify(cfg.substring(i + 1));
      }
      set(swcOptions, key, value);
    }
  }

  const cliOptions: CliOptions = {
    outDir: opts.outDir,
    outFile: opts.outFile,
    filename: opts.filename,
    filenames,
    sync: !!opts.sync,
    sourceMapTarget: opts.sourceMapTarget,
    extensions: opts.extensions,
    keepFileExtension: opts.keepFileExtension,
    verbose: !!opts.verbose,
    watch: !!opts.watch,
    relative: !!opts.relative,
    copyFiles: !!opts.copyFiles,
    includeDotfiles: !!opts.includeDotfiles,
    deleteDirOnStart: !!opts.deleteDirOnStart,
    quiet: !!opts.quiet,
    logWatchCompilation: !!opts.logWatchCompilation
  };

  return {
    swcOptions,
    cliOptions
  };
}
