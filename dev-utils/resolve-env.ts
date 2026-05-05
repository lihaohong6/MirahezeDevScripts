const argumentKeys = ['no-minify', 'no-rollup', 'oxc-minifier'];
const rxCliArg = new RegExp(`^--(${argumentKeys.join('|')})$`);

interface CustomCliArguments {
  'no-minify'?: boolean
  'no-rollup'?: boolean
  'oxc-minifier'?: boolean
}

/**
 * Parse custom Command Line Arguments.
 * 
 * @returns 
 */
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