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
// Validate embedded poses as well as the external manifests. They must share
// geometry measurements and filenames so a resolution upgrade cannot jump.
try {
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const embedded=html.match(/<script type="application\/json" id="critical-poses">([\s\S]*?)<\/script>/);
 if(embedded)for(const [variant,pack] of Object.entries(JSON.parse(embedded[1])).filter(([key])=>key==='compact'||key==='desktop')) {
   const manifest=JSON.parse(fs.readFileSync(path.join(root,'models/hero-frames/'+variant+'.json'),'utf8'));
   if(JSON.stringify(manifest)!==JSON.stringify(pack.manifest))errors.push('Poses embutidas diferem de '+variant+'.json');
   if(pack.thumbs.length!==manifest.frames.length||!pack.atlas.startsWith('data:image/webp;base64,'))errors.push('Atlas inicial inválido: '+variant);
   if(pack.thumbs.some(t=>t.x<0||t.y<0||t.w<=0||t.h<=0||t.x+t.w>pack.width||t.y+t.h>pack.height))errors.push('Pose inicial fora do atlas: '+variant);
 }
} catch(error){errors.push('Poses embutidas inválidas: '+error.message);}

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
  if (/^assets\/hero-motion\/(desktop|wide|compact|tablet)(?:-1x)?\.json$/.test(file)) {
    try {
      const manifest=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
      if(manifest.version!==1||manifest.frames.length!==81||manifest.sheets.length!==9)throw new Error('81 poses e nove grupos esperados');
      for(const sheet of manifest.sheets)check(sheet.file,file);
      for(const tile of manifest.frames){const sheet=manifest.sheets[tile.sheet];if(!sheet||tile.w<=0||tile.h<=0||tile.x<0||tile.y<0||tile.x+tile.w>sheet.width||tile.y+tile.h>sheet.height)throw new Error('pose fora do grupo');}
      const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),embedded=JSON.parse(html.match(/<script type="application\/json" id="critical-poses">([\s\S]*?)<\/script>/)[1]);
      if(JSON.stringify(embedded.motion?.[manifest.profile])!==JSON.stringify(manifest))throw new Error('grupos embutidos desatualizados');
    }catch(error){errors.push(file+': grupos de poses inválidos: '+error.message);}
  }
  if (/^assets\/hero-hd\/(desktop|wide|compact|tablet)(?:-1x)?\.json$/.test(file)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      if (manifest.version !== 1 || manifest.frames.length !== 81) throw new Error('81 poses esperadas');
      const original = JSON.parse(fs.readFileSync(path.join(root, 'models/hero-frames/' + manifest.variant + '.json'), 'utf8'));
      for (const [index, frame] of manifest.frames.entries()) {
        if (frame.index !== index || frame.raw !== original.frames[index].raw) throw new Error('ângulo diferente da pose pequena');
        if (frame.width <= 0 || frame.height <= 0) throw new Error('dimensão inválida');
        check(frame.file, file); check(frame.webp, file);
      }
      check(manifest.bezel.file, file); check(manifest.bezel.webp, file);
    } catch (error) { errors.push(file + ': sequência HD inválida: ' + error.message); }
  }
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
// O texto legal em vigor tem que estar também no endereço fixo da versão dele,
// <página>/versoes/AAAA-MM-DD/, que é o que mostra depois o que a pessoa leu.
// Quem grava é o tools/gerar-legais.pl. Sem esta conferência, mexer na
// /excluir-conta/ (escrita à mão) e esquecer de rodá-lo publicaria a versão
// nova sem cópia, e ninguém veria.
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const partesLegais = (html) => ({
  data: html.match(/<p class="updated">([\s\S]*?)<\/p>/)?.[1],
  main: html.match(/<main>\n([\s\S]*?)\n<\/main>/)?.[1],
});
for (const slug of ['termos', 'privacidade', 'excluir-conta']) {
  const atual = partesLegais(fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8'));
  const [, dia, mes, ano] = atual.data?.match(/(\d{1,2})º? de (\p{L}+) de (\d{4})/u) ?? [];
  const numero = meses.indexOf(mes?.toLowerCase()) + 1;
  if (!numero || atual.main === undefined) { errors.push(`${slug}/index.html: não achei a data ou o <main>`); continue; }
  const iso = `${ano}-${String(numero).padStart(2, '0')}-${dia.padStart(2, '0')}`;
  const copia = path.join(root, slug, 'versoes', iso, 'index.html');
  const guardada = fs.existsSync(copia) ? partesLegais(fs.readFileSync(copia, 'utf8')) : {};
  // A cópia mora três pastas abaixo da raiz, então ../ vira ../../../ (a mesma conta do gerador).
  if (guardada.data !== atual.data || guardada.main !== atual.main.replace(/((?:href|src)=")\.\.\//g, '$1../../../')) {
    errors.push(`${slug}/: a versão em vigor (${iso}) não está igual em ${slug}/versoes/${iso}/. Rode "perl tools/gerar-legais.pl ../parcelo/assets/legal" e commite o resultado.`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`GitHub Pages: ${files.size} arquivos; ${checked} referências locais verificadas, incluindo nomes exatos para Linux.`);
