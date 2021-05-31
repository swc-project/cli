import { transformFile, transformFileSync } from "@swc/core";
import { compile } from "../compile";

jest.mock("@swc/core");

describe('compile', () => {
  it("compile with sync transform", async () => {
    const options = {}
    await compile('test.ts', options, true)

    expect(transformFileSync).toHaveBeenCalledWith('test.ts', options)
  });

  it("compile with async transform", async () => {
    const options = {}
    await compile('test.ts', options, false);

    expect(transformFile).toHaveBeenCalledWith('test.ts', options)
  });
});
