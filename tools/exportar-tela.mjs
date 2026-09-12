/* ----------------------------------------------------------------------------
   Exporta a tela da home (o bloco `.tela--home` do index.html) como PNG, para
   servir de textura da malha `Phone_Display` do modelo 3D do Galaxy S25 Ultra
   no repositório `site-parcelo-v2`.

   Uso:  node tools/exportar-tela.mjs [saida.png] [escala]
   Padrão: tools/saida/tela-home.png, escala 3 (1152 x 2463).

   O PNG sai na proporção exata da malha (74,85 x 160,05 mm) e mapeia 1 para 1
   nas UVs dela: canto superior esquerdo da imagem no canto superior esquerdo da
   tela, que é o que o `flipY = false` do Three.js espera.

   Este script não escreve em outro repositório de propósito. Copiar o PNG para
   o `site-parcelo-v2` é um passo manual, para que nenhum agente atravesse de um
   repositório para o outro sozinho.
   -------------------------------------------------------------------------- */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saida = resolve(RAIZ, process.argv[2] || 'tools/saida/tela-home.png');
const escala = Number(process.argv[3] || 3);

const LARGURA_DP = 384;
const PROPORCAO = 160.05 / 74.85;
const largura = Math.round(LARGURA_DP * escala);
const altura = Math.round(LARGURA_DP * escala * PROPORCAO);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const navegador = NAVEGADORES.find((c) => existsSync(c));
if (!navegador) {
  console.error('Não achei Chrome nem Edge. Edite a lista NAVEGADORES.');
  process.exit(1);
}

const servidor = createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const arquivo = join(RAIZ, caminho === '/' ? 'index.html' : caminho);
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404).end('nao achei');
  }
});

await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const porta = servidor.address().port;
const alvo = `http://127.0.0.1:${porta}/tools/exportar-tela.html?escala=${escala}`;

await mkdir(dirname(saida), { recursive: true });
await rm(saida, { force: true });

const perfil = join(process.env.TEMP || '/tmp', `parcelo-exportar-${porta}`);
const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${perfil}`,
  '--force-device-scale-factor=1',
  `--window-size=${largura},${altura}`,
  '--virtual-time-budget=15000',
  `--screenshot=${saida}`,
  alvo,
];

console.log(`tela  ${largura} x ${altura}  (escala ${escala})`);
console.log(`fonte ${alvo}`);

const codigo = await new Promise((r) => {
  const p = spawn(navegador, args, { stdio: 'ignore' });
  p.on('exit', r);
  p.on('error', (e) => { console.error(e.message); r(1); });
});

servidor.close();
await rm(perfil, { recursive: true, force: true }).catch(() => {});

if (!existsSync(saida)) {
  console.error('O navegador não gravou o PNG. Código', codigo);
  process.exit(1);
}

/* Confere o cabeçalho do PNG, que é a única prova de que o tamanho saiu certo. */
const png = await readFile(saida);
const l = png.readUInt32BE(16);
const a = png.readUInt32BE(20);
const tamanho = (await stat(saida)).size;
console.log(`saida ${saida}`);
console.log(`png   ${l} x ${a}, ${(tamanho / 1024).toFixed(0)} kB`);
if (l !== largura || a !== altura) {
  console.error(`⚠️  esperava ${largura} x ${altura}`);
  process.exit(1);
}
