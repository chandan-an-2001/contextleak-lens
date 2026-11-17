import { cp, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public', 'ocr');
await mkdir(dest, { recursive: true });
await copyFile(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'), path.join(dest, 'worker.min.js'));
const core = path.join(root, 'node_modules/tesseract.js-core');
for (const name of await readdir(core)) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)) await cp(path.join(core, name), path.join(dest, name));
}
const dataRoot = path.join(root, 'node_modules/@tesseract.js-data/eng');
async function findLanguage(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isFile() && item.name === 'eng.traineddata.gz') return full;
    if (item.isDirectory()) { const found = await findLanguage(full); if (found) return found; }
  }
}
const language = await findLanguage(dataRoot);
if (!language) throw new Error('English OCR language data was not installed. Reinstall dependencies.');
await copyFile(language, path.join(dest, 'eng.traineddata.gz'));
console.log('OCR worker, WebAssembly cores, and English language assets are bundled locally.');
