import dirCommand from "./dir2";
import fileCommand from "./file";
import parseArgs from "./options";

const opts = parseArgs(process.argv);
const fn = opts.cliOptions.outDir ? dirCommand : fileCommand;

process.on("uncaughtException", function (err) {
  console.error(err);
  process.exit(1);
});

fn(opts).catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
