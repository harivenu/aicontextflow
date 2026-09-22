const esbuild = require('esbuild');

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isProduction = args.includes('--production');

async function main() {
  const buildOptions = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    console.log('[esbuild] Watching for file changes...');
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
    console.log('[esbuild] Extension bundled successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
