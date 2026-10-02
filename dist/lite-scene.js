import { HANDOFF_START, HANDOFF_END } from './handoff-motion.js';
import { sceneLayout } from './phone-layout.js';
import { transitionPose, DOCK_AT } from './money-transition.js';

const base = new URL('./models/hero-frames/desktop.json', import.meta.url);
const CACHE_LIMIT = 24;
const screens = ['app-home.jpg', 'app-cartoes-parcelas.jpg', 'app-compromissos-informais.jpg', 'app-pra-cancelar.jpg'];

// Prepared frames retain the original models; only nearby decoded images are held.
export class LiteScene {
  constructor(host, requestPaint) {
    this.host = host;
    this.requestPaint = requestPaint;
    this.cache = new Map();
    this.pending = new Set();
    this.badFrames = new Set();
    this.queue = [];
    this.activeLoads = 0;
    this.generation = 0;
    this.current = -1;
    this.element = document.createElement('div');
    this.element.className = 'lite-object';
    this.element.setAttribute('aria-hidden', 'true');
    this.screen = document.createElement('div');
    this.screen.className = 'lite-screen';
    this.screen.setAttribute('aria-hidden', 'true');
    this.screenImage = new Image();
    this.screenImage.src = new URL('./Imagens/' + screens[0], import.meta.url).href;
    this.screenShade = document.createElement('span');
    this.screen.append(this.screenImage, this.screenShade);
    this.host.append(this.element, this.screen);
    // Four screenshots are small in count and must be ready for fast chapter jumps.
    this.preloadedScreens = screens.map(file => {
      const image = new Image();
      image.src = new URL('./Imagens/' + file, import.meta.url).href;
      return image;
    });
  }

  async selectVariant(compact) {
    const variant = compact ? 'compact' : 'desktop';
    if (this.variant === variant) return;
    this.variant = variant;
    const generation = ++this.generation;
    this.manifest = null;
    this.cache.clear();
    this.pending.clear();
    this.badFrames.clear();
    this.queue = [];
    this.current = -1;
    this.host.dataset.frames = 'loading';
    this.screen.hidden = true;
    try {
      const response = await fetch(new URL(variant + '.json', base));
      if (!response.ok) throw new Error('Frame manifest unavailable');
      const manifest = await response.json();
      if (manifest.version !== 1 || !Array.isArray(manifest.frames) || manifest.frames.length < 2 || !manifest.screen || !manifest.halfSize || !manifest.moneyHalfSize) throw new Error('Invalid frame manifest');
      if (generation !== this.generation) return;
      this.manifest = manifest;
      const last = manifest.frames.length - 1;
      this.handoffFrames = Array.from({ length: Math.ceil(HANDOFF_END / DOCK_AT * last) - Math.floor(HANDOFF_START / DOCK_AT * last) + 1 }, (_, offset) => Math.floor(HANDOFF_START / DOCK_AT * last) + offset);
      this.requestPaint();
    } catch {
      if (generation === this.generation) this.host.dataset.frames = 'unavailable';
      // The HTML money/phone stills and all four chapters remain usable.
    }
  }

  update({ width, height, compact, raw, reduced, chapter, brightness, exchanging = false }) {
    this.latest = { width, height, compact, raw, reduced, chapter, brightness };
    this.selectVariant(compact);
    if (!this.manifest) return;
    const motion = transitionPose(raw, reduced);
    const frames = this.manifest.frames;
    const wanted = reduced ? (motion.exchange ? frames.length - 1 : 0)
      : Math.round(Math.min(raw / DOCK_AT, 1) * (frames.length - 1));
    const direction = wanted >= (this.wanted ?? wanted) ? 1 : -1;
    this.wanted = wanted;
    // Replace obsolete work on quick jumps instead of decoding the entire sequence.
    const nearby = [wanted];
    if (!reduced) nearby.push(...this.handoffFrames);
    if (!reduced) for (let offset = 1; offset <= 5; offset++) nearby.push(wanted + offset * direction, wanted - offset * direction);
    nearby.push(0, frames.length - 1, frames.length);
    this.queue = [...new Set(nearby)].filter(index => index >= 0 && index <= frames.length && !this.cache.has(index) && !this.pending.has(index) && !this.badFrames.has(index));
    this.pump();

    const canShowMixed = exchanging && this.handoffFrames.every(index => this.cache.has(index));
    const isClean = index => frames[index].raw <= .322 || frames[index].raw >= .358;
    let selected = wanted;
    if (!this.cache.has(selected) || (!canShowMixed && !isClean(selected))) {
      // Retain a nearby loaded pose during loading; never flash an empty frame.
      selected = [...this.cache.keys()].filter(index => index < frames.length && (canShowMixed || isClean(index))).sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
    }
    if (selected === undefined) return;
    const docked = motion.approach === 1 && selected === frames.length - 1;
    const useBezel = docked && this.cache.has(frames.length);
    const image = this.cache.get(useBezel ? frames.length : selected);
    const imageKey = useBezel ? frames.length : selected;
    this.cache.delete(imageKey);
    this.cache.set(imageKey, image);
    const frame = frames[selected];
    const layout = sceneLayout(width, height, compact, this.manifest.halfSize, this.manifest.moneyHalfSize);
    const pixels = layout.startHeight + (layout.endHeight - layout.startHeight) * motion.approach;
    const x = layout.startX + (width / 2 - layout.startX) * motion.approach;
    const y = layout.startY + (layout.endY - layout.startY) * motion.approach;
    this.position(this.element, x + frame.x * pixels, y + frame.y * pixels, frame.width * pixels, frame.height * pixels);
    if (this.current !== selected || this.showingBezel !== useBezel) {
      this.element.replaceChildren(image);
      this.current = selected;
      this.showingBezel = useBezel;
    }
    this.host.dataset.frames = 'ready';
    this.host.dataset.frame = String(selected);
    this.screen.hidden = !docked;
    this.screen.style.zIndex = useBezel ? 1 : 3;
    if (docked) {
      const screen = this.manifest.screen;
      this.position(this.screen, x + screen.x * pixels, y + screen.y * pixels, screen.width * pixels, screen.height * pixels);
      if (this.chapter !== chapter) {
        this.chapter = chapter;
        this.screenImage.src = this.preloadedScreens[chapter].src;
      }
      this.screenShade.style.opacity = String(1 - brightness);
    }
    // Screen-space measurements also keep the side cards aligned in lite mode.
    this.host.parentElement.style.setProperty('--dock-phone-width', (layout.endHeight * (.0776 / .1628)) + 'px');
    this.host.parentElement.style.setProperty('--cash-x', layout.startX + 'px');
    this.host.parentElement.style.setProperty('--cash-y', layout.startY + 'px');
    this.host.parentElement.style.setProperty('--cash-width', layout.startHeight * 1.33 + 'px');
    this.trim();
  }

  position(element, x, y, width, height) {
    const key = [x, y, width, height].map(value => value.toFixed(2)).join(':');
    if (element.dataset.position === key) return;
    element.dataset.position = key;
    element.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
    element.style.width = width.toFixed(2) + 'px';
    element.style.height = height.toFixed(2) + 'px';
  }

  pump() {
    while (this.activeLoads < 2 && this.queue.length) {
      const index = this.queue.shift();
      if (!this.manifest || this.cache.has(index) || this.pending.has(index)) continue;
      const generation = this.generation;
      const image = new Image();
      image.alt = '';
      image.decoding = 'async';
      this.activeLoads++;
      this.pending.add(index);
      image.src = new URL((this.manifest.frames[index]?.file || this.manifest.bezel), base).href;
      image.decode().then(() => {
        if (generation !== this.generation) return;
        this.cache.set(index, image);
        this.trim();
        this.requestPaint();
      }).catch(() => {
        if (generation === this.generation) this.badFrames.add(index);
      }).finally(() => {
        this.activeLoads--;
        if (generation === this.generation) this.pending.delete(index);
        this.pump();
      });
    }
  }

  trim() {
    for (const index of this.cache.keys()) {
      if (this.cache.size <= CACHE_LIMIT) break;
      if (index === this.current || index === this.wanted || index === 0 || (!this.latest.reduced && this.handoffFrames.includes(index)) || index >= this.manifest.frames.length - 1) continue;
      this.cache.delete(index);
    }
  }
}
