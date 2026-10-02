import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const files = new Set();
const errors = [];
function walk(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) errors.push(`Link simbólico não permitido: ${relative}`);
    else if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + '/');
    else files.add(relative);
  }
}
walk(root);
if (!files.has('index.html')) errors.push('dist/index.html não encontrado.');
let checked = 0;
function check(value, source, mapped = false) {
  value = value.trim().replaceAll('&amp;', '&');
  // %LINK% é preenchido pelo Firebase nos modelos de e-mail de /emails/.
  if (!value || value.startsWith('#') || /^%[A-Z_]+%$/.test(value) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  if (value.startsWith('/')) {
    errors.push(`${source}: caminho começa com / e pode quebrar no endereço do repositório: ${value}`);
    return;
  }
  const clean = decodeURIComponent(value.split(/[?#]/)[0]);
  let target = path.posix.normalize(path.posix.join(mapped ? '' : path.posix.dirname(source), clean));
  // Link para pasta (privacidade/, ../) é servido pelo index.html dela.
  if (clean === '' || clean.endsWith('/')) target = path.posix.join(target, 'index.html');
  checked++;
  if (!files.has(target)) errors.push(`${source}: arquivo ausente ou nome com maiúsculas/minúsculas diferente: ${value}`);
}
for (const file of files) {
  if (/^models\/hero-frames\/(desktop|compact)\.json$/.test(file)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      if (manifest.version !== 1 || !Array.isArray(manifest.frames) || manifest.frames.length < 2) throw new Error('formato inválido');
      for (const frame of manifest.frames) check(frame.file, file);
      check(manifest.bezel, file);
    } catch (error) { errors.push(file + ': sequência de imagens inválida: ' + error.message); }
  }
  if (!/\.(?:html|css|js)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.html')) {
    for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) check(match[1], file);
    for (const match of text.matchAll(/<script\s+type=["']importmap["']>([\s\S]*?)<\/script>/g)) {
      for (const value of Object.values(JSON.parse(match[1]).imports)) {
        if (!value.endsWith('/')) check(value, file);
      }
    }
  }
  if (file.endsWith('.css') || file.endsWith('.html')) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) check(match[1], file);
  }
  if (file.endsWith('.js')) {
    // Bibliotecas contêm exemplos em comentários; examinar seus imports reais.
    for (const match of text.matchAll(/\b(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const value = match[1];
      if (value === 'three') check('vendor/three/build/three.module.js', file, true);
      else if (value.startsWith('three/addons/')) check(value.replace('three/addons/', 'vendor/three/addons/'), file, true);
      else if (value.startsWith('.')) check(value, file);
    }
    if (!file.startsWith('vendor/')) {
      for (const match of text.matchAll(/['"]((?:\.\/)?(?:Imagens|models|assets|fonts)\/[^'"\n]+)['"]/g)) check(match[1], file);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`GitHub Pages: ${files.size} arquivos; ${checked} referências locais verificadas, incluindo nomes exatos para Linux.`);
