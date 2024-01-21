import { globSources, splitCompilableAndCopyable } from "../sources";
import fs from "fs";
import glob from "fast-glob";

jest.mock("fs");
jest.mock("fast-glob");

describe("globSources", () => {
  beforeEach(() => {
    (fs as any).resetMockStats();
  });

  it("exclude dotfiles sources when includeDotfiles=false", async () => {
    const files = await globSources([".dotfile"], [], [], false);

    expect([...files]).toEqual([]);
  });

  it("include dotfiles sources when includeDotfiles=true", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    const files = await globSources([".dotfile"], [], [], true);

    expect([...files]).toEqual([".dotfile"]);
  });

  it("include multiple file sources", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });
    const files = await globSources([".dotfile", "file"], [], [], true);

    expect([...files]).toEqual([".dotfile", "file"]);
  });

  it("exclude files that errors on stats", async () => {
    (fs as any).setMockStats({ ".dotfile": { isDirectory: () => false } });
    (fs as any).setMockStats({ file: new Error("Failed stat") });
    const files = await globSources([".dotfile", "file"], [], [], true);

    expect([...files]).toEqual([".dotfile"]);
  });

  it("includes all files from directory", async () => {
    (fs as any).setMockStats({ directory: { isDirectory: () => true } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });

    (glob as unknown as jest.Mock).mockResolvedValue(["fileDir1", "fileDir2"]);
    const files = await globSources(["file", "directory"], [], [], true);

    expect([...files]).toEqual(["file", "fileDir1", "fileDir2"]);
  });

  it("exclude files from directory that fail to glob", async () => {
    (fs as any).setMockStats({ directory: { isDirectory: () => true } });
    (fs as any).setMockStats({ file: { isDirectory: () => false } });

    (glob as unknown as jest.Mock).mockRejectedValue(new Error("Failed"));
    const files = await globSources(["file", "directory"], [], [], true);

    expect([...files]).toEqual(["file"]);
  });
});

describe("splitCompilableAndCopyable", () => {
  const extensions = [".ts"];
  it("separate compilable and copyable when copyFiles=true", () => {
    const files = ["test.ts", "test.txt"];
    const [compilable, copyable] = splitCompilableAndCopyable(
      files,
      extensions,
      true
    );

    expect(compilable).toEqual(["test.ts"]);
    expect(copyable).toEqual(["test.txt"]);
  });

  it("separate compilable and copyable when copyFiles=false", () => {
    const files = ["test.ts", "test.txt"];
    const [compilable, copyable] = splitCompilableAndCopyable(
      files,
      extensions,
      false
    );

    expect(compilable).toEqual(["test.ts"]);
    expect(copyable).toEqual([]);
  });
});
