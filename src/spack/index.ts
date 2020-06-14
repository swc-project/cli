import { bundle } from '@swc/core';

import { requireChokidar } from '../swc/util';
import parseSpackArgs from './options';

process.title = 'spack';

(async () => {
    const { cliOptions, spackOptions } = await parseSpackArgs(process.argv);
    async function build() {
        const output = await bundle(spackOptions);
        console.log(output)
    }

    // if (cliOptions.watch) {
    //     throw new Error('watch is not implemented yet')
    // }

    await build();
})()