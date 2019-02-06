import readdirRecursive from "fs-readdir-recursive";
import * as swc from "swc";
import includes from "lodash/includes";
import path from "path";
import fs from "fs";

export function chmod(src: fs.PathLike, dest: fs.PathLike) {
    fs.chmodSync(dest, fs.statSync(src).mode);
}

type ReaddirFilter = (filename: string) => boolean;

export function readdir(
    dirname: fs.PathLike,
    includeDotfiles: boolean,
    filter?: ReaddirFilter,
) {
    // @ts-ignore
    return readdirRecursive(dirname, (filename: string, _index, currentDirectory: string) => {
        const stat = fs.statSync(path.join(currentDirectory, filename));

        if (stat.isDirectory()) return true;

        return (
            (includeDotfiles || filename[0] !== ".") && (!filter || filter(filename))
        );
    });
}

export function readdirForCompilable(
    dirname: string,
    includeDotfiles: boolean,
    altExts?: Array<string>,
): string[] {
    return readdir(dirname, includeDotfiles, function (filename) {
        return isCompilableExtension(filename, altExts);
    });
}

/**
 * Test if a filename ends with a compilable extension.
 */
export function isCompilableExtension(
    filename: string,
    altExts?: Array<string>,
): boolean {
    const exts = altExts || [".js", ".jsx", ".es6", ".es", ".mjs", ".ts"];
    const ext = path.extname(filename);
    return includes(exts, ext);
}

export function addSourceMappingUrl(code: string, loc: string) {
    return code + "\n//# sourceMappingURL=" + path.basename(loc);
}

export function transform(filename: string, code: string, opts: swc.Options): Promise<swc.Output> {
    opts = {
        filename,
        ...opts,
    };

    return swc.transform(code, opts)
}

export function compile(filename: string, opts: swc.Options): Promise<swc.Output> {
    opts = {
        ...opts,
    };
    return swc.transformFile(filename, opts)
}

export function deleteDir(path: fs.PathLike) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            const curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                deleteDir(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

process.on("uncaughtException", function (err) {
    console.error(err);
    process.exit(1);
});

export function requireChokidar() {
    try {
        return require("chokidar");
    } catch (err) {
        console.error(
            "The optional dependency chokidar failed to install and is required for " +
            "--watch. Chokidar is likely not supported on your platform.",
        );
        throw err;
    }
}

export function adjustRelative(relative: string, keepFileExtension: boolean) {
    if (keepFileExtension) {
        return relative;
    }
    return relative.replace(/\.(\w*?)$/, "") + ".js";
}