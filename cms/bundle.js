// Bundle the admin UI (Lit + refrakt) with esbuild. `--watch` rebuilds on change.
import * as esbuild from 'esbuild';
import path from 'node:path';
import { ROOT } from '../lib/content.js';

const options = {
  entryPoints: [path.join(ROOT, 'cms/ui/app.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outdir: path.join(ROOT, 'cms/ui/dist'),
  sourcemap: true,
  minify: true,
  logLevel: 'info',
};

export async function bundle({ watch = false } = {}) {
  if (watch) {
    const ctx = await esbuild.context({ ...options, minify: false });
    await ctx.watch();
    return ctx;
  }
  return esbuild.build(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'cms/bundle.js')) {
  bundle({ watch: process.argv.includes('--watch') }).catch(() => process.exit(1));
}
