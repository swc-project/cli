import { bundle } from '@swc/core';

import parseSpackArgs from './options';


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