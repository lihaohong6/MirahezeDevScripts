const argumentKeys = ['no-minify', 'no-rollup'];
const rxCliArg = new RegExp(`^--(${argumentKeys.join('|')})$`);

interface CustomCliArguments {
  'no-minify'?: boolean
  'no-rollup'?: boolean
}

export function resolveCommandLineArgumentsPassedToVite() {
  const customArgs = process.argv.slice(3);
  let args: CustomCliArguments = {};
  for (const arg of customArgs) {
    const m = arg.match(rxCliArg);
    if (m === null) continue;
    //@ts-ignore
    args[m[1]] = true;
  }

  return args;
}