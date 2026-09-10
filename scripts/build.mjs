import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
export async function extension() {
  for (const [outdir, manifest, target] of [['dist/extension','manifest.json','chrome120'],['dist/extension-firefox','manifest.firefox.json','firefox128']]) {
    await mkdir(outdir, { recursive: true });
    await build({ entryPoints: ['extension/worker.ts','extension/content.ts','extension/popup.ts'], outdir, bundle: true, platform: 'browser', target, format: 'iife' });
    await copyFile(`extension/${manifest}`, `${outdir}/manifest.json`);
    for (const f of ['popup.html','popup.css']) await copyFile(`extension/${f}`, `${outdir}/${f}`);
    if(manifest==='manifest.json'){
      await build({entryPoints:['extension/offscreen.ts'],outdir,bundle:true,platform:'browser',target,format:'iife'});
      for(const f of ['offscreen.html','capture-worklet.js'])await copyFile(`extension/${f}`,`${outdir}/${f}`);
    }
  }
}
export async function desktop() {
  await mkdir('dist/renderer', { recursive: true });
  await build({ entryPoints: ['desktop/main.ts','desktop/preload.ts'], outdir: 'dist/desktop', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', target: 'node22', external: ['electron'], format: 'cjs' });
  await build({ entryPoints: ['desktop/renderer/index.tsx'], outdir: 'dist/renderer', bundle: true, platform: 'browser', target: 'chrome130', jsx: 'automatic', loader:{'.ttf':'file'},assetNames:'fonts/[name]-[hash]', define: { 'process.env.NODE_ENV': '"production"' } });
  await copyFile('desktop/renderer/index.html','dist/renderer/index.html');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'extension') await desktop();
  await extension();
}
