import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm(new URL('../docs/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await cp(new URL('../dist/', import.meta.url), new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/.nojekyll', import.meta.url), '');
console.log('Ready-built GitHub Pages site saved to docs/');
