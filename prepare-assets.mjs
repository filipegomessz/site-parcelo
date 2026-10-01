import fs from 'node:fs';
import path from 'node:path';
// Imagens is the source folder; dist/Imagens is its publishable copy.
const source = new URL('./Imagens/', import.meta.url);
const output = new URL('./dist/Imagens/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
for (const name of fs.readdirSync(source)) {
  if (/\.(png|jpe?g|webp|svg)$/i.test(name)) fs.copyFileSync(new URL(encodeURIComponent(name), source), new URL(encodeURIComponent(name), output));
}
console.log('Imagens do site sincronizadas.');
