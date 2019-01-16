import parseArgs from './options';
import dirCommand from "./dir";
import fileCommand from "./file";


const opts = parseArgs(process.argv);
const fn = opts.cliOptions.outDir ? dirCommand : fileCommand;
fn(opts).catch((err: Error) => {
    console.error(err);
    process.exit(1);
});