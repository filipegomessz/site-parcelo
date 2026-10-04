const mobile = ['./assets/optimized/app-home-640.webp','./assets/optimized/app-cartoes-parcelas-640.webp','./assets/optimized/app-compromissos-informais-640.webp','./assets/optimized/app-pra-cancelar-640.webp'];
const desktop = ['./assets/optimized/app-home-1080.webp','./assets/optimized/app-cartoes-parcelas-1080.webp','./assets/optimized/app-compromissos-informais-1080.webp','./assets/optimized/app-pra-cancelar-1080.webp'];
// 640 px covers the phone's displayed screen on ordinary notebook/desktop
// monitors. Retain the original 1080 px captures for high-density displays.
export const screenSources = (innerWidth <= 1100 || ((devicePixelRatio||1)<=1.05&&innerWidth<=2560) ? mobile : desktop).map(file => new URL(file, import.meta.url).href);
const pending = new Map();
export function loadScreen(index) {
  if (!pending.has(index)) {
    const image = new Image(); image.decoding = 'async';
    image.src = screenSources[index];
    const promise = image.decode().then(() => image).catch(error => { pending.delete(index); throw error; });
    pending.set(index, promise);
  }
  return pending.get(index);
}
// First capture follows the note. The remaining captures follow their chapters.
export function prepareScreens(raw, chapterProgress = 0) {
  const wanted = new Set();
  if (raw >= .20) wanted.add(0);
  if (raw >= .82) {
    const chapter = Math.min(3, Math.floor(chapterProgress * 4));
    wanted.add(chapter);
    if (chapter < 3 && chapterProgress * 4 - chapter >= .72) wanted.add(chapter + 1);
  }
  wanted.forEach(index => loadScreen(index).catch(() => {}));
}
