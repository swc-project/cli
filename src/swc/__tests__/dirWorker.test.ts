import { Options } from "@swc/core";
import handleCompile from "../dirWorker";
import { CliOptions, DEFAULT_OUT_FILE_EXTENSION } from "../options";
import * as utilModule from '../util';

type HandleCompileOptions = {
  cliOptions: CliOptions;
  swcOptions: Options;
  sync: false,
  outDir: "outDir",
  filename: string,
  outFileExtension?: string;
}

const createHandleCompileOptions = (options?: Partial<HandleCompileOptions>): HandleCompileOptions => ({
  cliOptions: {
    outDir: "",
    outFile: "",
    filename: "",
    stripLeadingPaths: false,
    filenames: [],
    sync: false,
    workers: undefined,
    sourceMapTarget: undefined,
    extensions: [],
    watch: false,
    copyFiles: false,
    outFileExtension: "",
    includeDotfiles: false,
    deleteDirOnStart: false,
    quiet: true,
    only: [],
    ignore: [],
  },
  swcOptions: {},
  sync: false,
  outDir: "outDir",
  filename: "",
  ...options,
});

jest.mock('../util', () => ({
  ...jest.requireActual("../util"),
  compile: jest.fn(),
}));

describe("dirWorker", () => {
  it('should call "compile" with the "DEFAULT_OUT_FILE_EXTENSION" when "outFileExtension" is undefined', async () => {
    const filename = 'test';
    const options = createHandleCompileOptions({
      filename: `${filename}.ts`
    });

    try {
      await handleCompile(options);
    } catch (err) {
      // We don't care about the error in this test, we want to make sure that "compile" was called
    }

    // Assert that subFunction was called with the correct parameter
    expect(utilModule.compile).toHaveBeenCalledWith(options.filename, { sourceFileName: `../${options.filename}`}, options.sync, `${options.outDir}/${filename}.${DEFAULT_OUT_FILE_EXTENSION}`);
  });
});

describe("dirWorker", () => {
  it('should call "compile" with "outFileExtension" when undefined', async () => {
    const filename = 'test';
    const options = createHandleCompileOptions({
      filename: `${filename}.ts`,
      outFileExtension: 'cjs'
    });

    try {
      await handleCompile(options);
    } catch (err) {
      // We don't care about the error in this test, we want to make sure that "compile" was called
    }

    // Assert that subFunction was called with the correct parameter
    expect(utilModule.compile).toHaveBeenCalledWith(options.filename, { sourceFileName: `../${options.filename}`}, options.sync, `${options.outDir}/${filename}.${options.outFileExtension}`);
  });
});
