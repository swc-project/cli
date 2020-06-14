import { bundle } from '@swc/core';
import { relative, join, dirname } from 'path'
import parseSpackArgs from './options';
import { writeFile, mkdir } from 'fs';
import { promisify } from 'util';

const write = promisify(writeFile);
const makeDir = promisify(mkdir);

(async () => {
    const { cliOptions, spackOptions } = await parseSpackArgs(process.argv);

    async function build() {
        const start = process.hrtime();
        const output = await bundle(spackOptions);
        const end = process.hrtime(start);
        console.info(`Done: ${end[0]}s ${end[1] / 1000000}ms`);

        if (spackOptions.output?.path) {
            await Object.keys(output).map(async (name) => {
                const filename = relative(process.cwd(), name);
                const fullPath = join(spackOptions.output.path, filename)
                await makeDir(dirname(fullPath), { recursive: true });

                await write(fullPath, output[name].code, 'utf-8');
            });
        }
    }

    // if (cliOptions.watch) {
    //     throw new Error('watch is not implemented yet')
    // }

    await build();
})()