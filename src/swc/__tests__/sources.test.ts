import { globSources, slitCompilableAndCopyable } from "../sources";
import fs from "fs";
import glob from "fast-glob";

jest.mock("fs");
jest.mock("fast-glob");

describe("globSources", () => {
  beforeEach(() => {
    (fs as any).resetMockStats();
  });

  it("exclude dotfiles sources when includeDotfiles=false", async () => {
    const files = await globSources([".dotfile"], { includeDotfiles: false });

    expect([...files]).toEqual([]);
  });

  it("include dotfiles sources when includeDotfiles=true", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    const files = await globSources([".dotfile"], { includeDotfiles: true });

    expect([...files]).toEqual([".dotfile"]);
  });

  it("include multiple file sources", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });
    const files = await globSources([".dotfile", "file"], {
      includeDotfiles: true,
    });

    expect([...files]).toEqual([".dotfile", "file"]);
  });

  it("exclude files that errors on stats", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    (fs as any).setMockStats({ file: new Error("Failed stat") });
    const files = await globSources([".dotfile", "file"], {
      includeDotfiles: true,
    });

    expect([...files]).toEqual([".dotfile"]);
  });

  it("includes all files from directory", async () => {
    (fs as any).setMockStats({ directory: { isDirectory: () => true } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });

    (glob as unknown as jest.Mock).mockResolvedValue(["fileDir1", "fileDir2"]);
    const files = await globSources(["file", "directory"], {
      includeDotfiles: true,
    });

    expect([...files]).toEqual(["file", "fileDir1", "fileDir2"]);
  });

  it("exclude files from directory that fail to glob", async () => {
    (fs as any).setMockStats({ directory: { isDirectory: () => true } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });

    (glob as unknown as jest.Mock).mockRejectedValue(new Error("Failed"));
    const files = await globSources(["file", "directory"], {
      includeDotfiles: true,
    });

    expect([...files]).toEqual(["file"]);
  });

  it("ignore file by glob", async () => {
    (fs as any).setMockStats({ "index.js": { isDirectory: () => false } });
    (fs as any).setMockStats({ "index.spec.js": { isDirectory: () => false } });

    const files = await globSources(["index.js", "index.spec.js"], {
      ignorePatterns: ["**/*.spec.js"],
    });

    expect([...files]).toEqual(["index.js"]);
  });

  it("inclide file by glob", async () => {
    (fs as any).setMockStats({ "index.js": { isDirectory: () => false } });
    (fs as any).setMockStats({ "index.spec.js": { isDirectory: () => false } });

    const files = await globSources(["index.js", "index.spec.js"], {
      onlyPatterns: ["**/*.spec.js"],
    });

    expect([...files]).toEqual(["index.spec.js"]);
  });

  it("inclide files from dir by glob", async () => {
    (fs as any).setMockStats({ src: { isDirectory: () => true } });
    (fs as any).setMockStats({ "src/index.js": { isDirectory: () => false } });
    (fs as any).setMockStats({
      "src/index.spec.js": { isDirectory: () => false },
    });

    (glob as unknown as jest.Mock).mockResolvedValue([
      "src/index.js",
      "src/index.spec.js",
    ]);
    const files = await globSources(["src"], {
      onlyPatterns: ["**/*.spec.js"],
    });

    expect([...files]).toEqual(["src/index.spec.js"]);
  });
});

describe("slitCompilableAndCopyable", () => {
  const extensions = [".ts"];
  it("separate compilable and copyable when copyFiles=true", () => {
    const files = ["test.ts", "test.txt"];
    const [compilable, copyable] = slitCompilableAndCopyable(
      files,
      extensions,
      true
    );

    expect(compilable).toEqual(["test.ts"]);
    expect(copyable).toEqual(["test.txt"]);
  });

  it("separate compilable and copyable when copyFiles=false", () => {
    const files = ["test.ts", "test.txt"];
    const [compilable, copyable] = slitCompilableAndCopyable(
      files,
      extensions,
      false
    );

    expect(compilable).toEqual(["test.ts"]);
    expect(copyable).toEqual([]);
  });
});
