import { bundle } from '@swc/core';
import { relative, join, dirname } from 'path'
import parseSpackArgs from './options';
import { writeFile, mkdir } from 'fs';
import { promisify } from 'util';
import { findLastIndex } from 'lodash';

const write = promisify(writeFile);
const makeDir = promisify(mkdir);


(async () => {
    const { cliOptions, spackOptions } = await parseSpackArgs(process.argv);

    function isUserDefinedEntry(name: string) {
        if (typeof spackOptions.entry === 'string') {
            return spackOptions.entry === name
        }
        if (Array.isArray(spackOptions.entry)) {
            for (const e of spackOptions.entry) {
                if (e === name) {
                    return true;
                }
            }
            return false;
        }

        return name in spackOptions.entry;
    }


    async function build() {
        const bundleStart = process.hrtime();
        const output = await bundle(spackOptions);
        const bundleEnd = process.hrtime(bundleStart);
        console.info(`Bindling done: ${bundleEnd[0]}s ${bundleEnd[1] / 1000000}ms`);

        const emitStart = process.hrtime();
        if (spackOptions.output?.path) {
            await Object.keys(output).map(async (name) => {
                if (isUserDefinedEntry(name)) {
                    const fullPath = join(spackOptions.output.path, spackOptions.output.name.replace('[name]', name));
                    ``
                    await makeDir(dirname(fullPath), { recursive: true });
                    await write(fullPath, output[name].code, 'utf-8');
                } else {
                    const filename = relative(process.cwd(), name);
                    const fullPath = join(spackOptions.output.path, filename)

                    await makeDir(dirname(fullPath), { recursive: true });
                    await write(fullPath, output[name].code, 'utf-8');
                }
            });
        } else {
            throw new Error('Cannot print to stdout: not implemented yet')
        }
        const emitEnd = process.hrtime(emitStart);
        console.info(`Done: ${emitEnd[0]}s ${emitEnd[1] / 1000000}ms`);

    }

    // if (cliOptions.watch) {
    //     throw new Error('watch is not implemented yet')
    // }

    await build();
})()