import { join } from "path";
import { getDest } from "../util";

describe("getDest", () => {
  it("does not modify the filename by default", () => {
    expect(
      getDest(join(process.cwd(), "src/path/name.ts"), "foo/bar", false)
    ).toEqual("foo/bar/src/path/name.ts");
  });

  it("when stripLeadingPaths is true, it removes leading paths", () => {
    expect(
      getDest(join(process.cwd(), "src/path/name.ts"), "foo/bar", true)
    ).toEqual("foo/bar/path/name.ts");
  });

  it("when stripLeadingPaths is true, it also resolves relative paths", () => {
    expect(
      getDest(join(process.cwd(), "../../path/name.ts"), "foo/bar", true)
    ).toEqual("foo/bar/path/name.ts");
  });
});
