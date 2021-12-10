import type { Options } from "@swc/core";
import deepmerge from "deepmerge";

import parserArgs, { CliOptions, initProgram } from "../options";

interface ParserArgsReturn {
  swcOptions: Options;
  cliOptions: CliOptions;
}

const createDefaultResult = (): ParserArgsReturn => ({
  cliOptions: {
    copyFiles: false,
    deleteDirOnStart: false,
    extensions: [".js", ".jsx", ".es6", ".es", ".mjs", ".ts", ".tsx"],
    // @ts-expect-error
    filename: undefined,
    filenames: ["src"],
    includeDotfiles: false,
    // @ts-expect-error
    outDir: undefined,
    // @ts-expect-error
    outFile: undefined,
    quiet: false,
    sourceMapTarget: undefined,
    sync: false,
    watch: false,
  },
  swcOptions: {
    configFile: undefined,
    jsc: { parser: undefined, transform: {} },
    sourceFileName: undefined,
    sourceMaps: undefined,
    sourceRoot: undefined,
    swcrc: true,
  },
});

describe("parserArgs", () => {
  let defaultResult: ParserArgsReturn;

  beforeEach(() => {
    defaultResult = createDefaultResult();
    initProgram();
  });

  it("minimal args returns default result", async () => {
    const args = ["node", "/path/to/node_modules/swc-cli/bin/swc.js", "src"];
    const result = await parserArgs(args);
    expect(result).toEqual(defaultResult);
  });

  describe("errors", () => {
    let mockExit: jest.SpyInstance;
    let mockConsoleError: jest.SpyInstance;

    beforeAll(() => {
      //@ts-expect-error
      mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
      mockConsoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
    });

    beforeEach(() => {
      mockExit.mockClear();
      mockConsoleError.mockClear();
    });

    afterAll(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it("exits without filenames", async () => {
      const args = ["node", "/path/to/node_modules/swc-cli/bin/swc.js"];
      await parserArgs(args);
      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
    });

    it("--watch exits without --out-dir", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "src",
        "--watch",
      ];
      await parserArgs(args);
      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
    });

    it("--watch exits without filenames", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--watch",
        "--out-dir",
        "esm",
      ];
      await parserArgs(args);
      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledTimes(3);
    });

    it("--out-dir exits with conflicting -out-file", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "src",
        "--out-file",
        "esm/index.js",
        "--out-dir",
        "esm",
      ];
      await parserArgs(args);
      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
    });
  });

  describe("--source-maps", () => {
    it("source maps is ambiguous", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "src",
        "--source-maps",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult, {
        swcOptions: { sourceMaps: true },
      });
      expect(result).toEqual(expectedOptions);
    });

    it("source maps true", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--source-maps",
        "true",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult, {
        swcOptions: { sourceMaps: true },
      });
      expect(result).toEqual(expectedOptions);
    });

    it("source maps inline", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "-s",
        "inline",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult, {
        swcOptions: { sourceMaps: "inline" },
      });
      expect(result).toEqual(expectedOptions);
    });
  });

  describe("--config", () => {
    it("throws with no config", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "src",
        "-C",
      ];
      expect(() => parserArgs(args)).toThrow();
    });

    it("react development", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--config",
        "jsc.transform.react.development=true",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult.swcOptions, {
        jsc: { transform: { react: { development: true } } },
      });
      expect(result.swcOptions).toEqual(expectedOptions);
    });

    it("react development and commonjs (two config options)", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--config",
        "jsc.transform.react.development=true",
        "-C",
        "module.type=commonjs",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult.swcOptions, {
        jsc: { transform: { react: { development: true } } },
        module: { type: "commonjs" },
      });
      expect(result.swcOptions).toEqual(expectedOptions);
    });

    it("react development and commonjs (comma-separated)", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--config",
        "jsc.transform.react.development=true,module.type=commonjs",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult.swcOptions, {
        jsc: { transform: { react: { development: true } } },
        module: { type: "commonjs" },
      });
      expect(result.swcOptions).toEqual(expectedOptions);
    });

    it("no equals sign", async () => {
      const args = [
        "node",
        "/path/to/node_modules/swc-cli/bin/swc.js",
        "--config",
        "no_equals",
        "src",
      ];
      const result = await parserArgs(args);
      const expectedOptions = deepmerge(defaultResult.swcOptions, {
        no_equals: true,
      });
      expect(result.swcOptions).toEqual(expectedOptions);
    });
  });
});
