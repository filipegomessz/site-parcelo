import { HandoffMotion } from './handoff-motion.js';
import { screenSources, prepareScreens, loadScreen } from './screen-assets.js';
import { LiteScene } from './lite-scene.js';
import { sceneLayout } from './phone-layout.js';
import { transitionPose, HANDOFF_AT, DOCK_AT } from './money-transition.js';

const experience = document.querySelector('.scene-track');
const intro = document.querySelector('.hero-intro');
const stage = document.querySelector('.stage');
const sceneShade = stage.querySelector('.shade');
const sceneProgressFill = stage.querySelector('.scene-progress span');
const host = document.querySelector('.phone-scene');
const features = document.querySelector('.feature-layout');
const featurePairs = [...features.querySelectorAll('.feature-pair')];
// These cards contain text only. aria-hidden controls their accessibility
// until arrival; remove the inherited inert styles during initial setup.
features.inert = false;
const chapterRail = document.querySelector('.chapter-rail');
const chapterBars = [...chapterRail.querySelectorAll('.chapter-rail-bars span')];
const chapterCount = chapterRail.querySelector('.chapter-count');
const fallbackImage = document.querySelector('.phone-fallback img');
const interlude = document.querySelector('.image-interlude');
const qr = document.querySelector('.qr-dock');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const compactLayout = matchMedia('(max-width: 1100px)');
// Both the photograph and the phone move together; the palm stays registered.
const navigationLinks = [...document.querySelectorAll('.glass-nav a:not(.nav-brand)')];
const navigationSections = ['secao-3', 'secao-4', 'secao-5', 'faq'].map(id => document.getElementById(id));
const storiesSection = document.querySelector('.stories-section');
const footer = document.querySelector('.site-footer');
const ease = value => value * value * (3 - 2 * value);
const MathUtils = { clamp: (v, min, max) => Math.max(min, Math.min(max, v)), lerp: (a, b, t) => a + (b - a) * t };
let THREE, GLTFLoader, RoomEnvironment, batchStaticMeshes;
let renderer, scene, camera, phone, phoneModel, moneyModel, screenMaterial, environmentTarget;
let liteScene, lite = false, lastMotionTick = 0, qualitySamples = [], poorWindows = 0, severeFrames = 0, monitoringAfter = Infinity;
function paintLite() {
  liteScene?.update({ width, height, compact: compactLayout.matches, raw: visualRaw, exchanging: handoffMotion.active,
    reduced: reduced.matches, chapter: activeChapter, brightness: screenBrightness, chapterProgress: readingProgress });
}
function activateLite(reason) {
  if (lite) return;
  lite = true; failed = true; ready = false;
  cancelAnimationFrame(frame); frame = 0;
  floatAnimation?.cancel(); floatAnimation = undefined;
  document.documentElement.dataset.renderMode = 'prepared';
  host.dataset.mode = 'prepared'; host.dataset.reason = reason; host.dataset.state = 'ready';
  // A downgrade is permanent for this visit: no expensive quality oscillation.
  if (renderer) {
    const geometries = new Set(), materials = new Set(), textures = new Set(screenTextures);
    scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose()); environmentTarget?.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    renderer = undefined; scene = undefined; screenTextures = [];
    phone = phoneModel = moneyModel = screenMaterial = camera = environmentTarget = undefined;
  }
  liteScene = new LiteScene(host, () => { if (!document.hidden && inView) requestRender(); });
  document.dispatchEvent(new Event('parcelo:render-mode'));
  updateScroll(false, true); paintLite(); requestRender();
}
function monitorMotion(time, moving) {
  if (!moving || reduced.matches || time < monitoringAfter) { lastMotionTick = 0; qualitySamples = []; poorWindows = 0; severeFrames = 0; return; }
  if (lastMotionTick) {
    const interval = time - lastMotionTick;
    severeFrames = interval >= 120 ? severeFrames + 1 : 0;
    if (severeFrames >= 3) { activateLite('sustained-slow-frames'); return; }
    qualitySamples.push(interval);
    if (qualitySamples.length >= 12) {
      const poor = qualitySamples.filter(value => value > 40).length >= 8;
      poorWindows = poor ? poorWindows + 1 : 0;
      qualitySamples = [];
      if (poorWindows >= 2) activateLite('sustained-slow-frames');
    }
  }
  lastMotionTick = time;
}
const handoffMotion = new HandoffMotion();
let visualRaw = 0;
let moneyHalfSize, motion = transitionPose(0);
const handoff = { value: 0 };
let screenTextures = [];
const fallbackScreens = screenSources;
let frame = 0, lastFrame = 0, lastTick = 0, progress = 0, width = 0, height = 0;
let targetRaw = 0, displayedRaw = 0;
let screenBrightness = 1, screenIndex = 0, activeChapter = 0;
let chapterTransition = null, readingProgress = 0;
const pairStates = featurePairs.map((_, index) => ({ opacity: index === 0 ? 1 : 0, y: 0 }));
const preparedPairs = new Set([0]);
let layout, modelHalfSize, scrollDirty = false, needsRender = true, lastPose;
let previousSize = '', activeSection = '', lastDocked, lastIntroHidden;
let panelsPrepared = false;
let opaqueBackdropTimer;
let panelEntranceAnimations = [];
let floatAnimation, floatAmplitude = -1;
let bufferSize = '', readingResolution = false;
const transmissionWidth = { value: 1 };
// Bound actual raster work, including large/high-density monitors.
const MAX_SCENE_PIXELS = 1_000_000;
const styleCache = new WeakMap();
function setStyle(element, name, value) {
  let values = styleCache.get(element);
  if (!values) { values = new Map(); styleCache.set(element, values); }
  if (values.get(name) === value) return;
  values.set(name, value); element.style.setProperty(name, value);
}
function setData(name, value) { if (host.dataset[name] !== value) host.dataset[name] = value; }
let inView = true, ready = false, failed = false;
const fov = 32;

function placeFeatures() {
  width = stage.clientWidth;
  height = stage.clientHeight;
}

function approachTravel() { return height * (reduced.matches ? .65 : compactLayout.matches ? 2 : 2.2); }

// One clock drives the screen and copy. Scrolling selects a chapter; it
// never scrubs its transition, so stopping the wheel cannot freeze a fade.
function advanceChapter(time = performance.now()) {
  const transition = chapterTransition;
  const fraction = transition ? MathUtils.clamp((time - transition.start) / 380, 0, 1) : 1;
  const blend = 1 - Math.pow(1 - fraction, 3);
  screenBrightness = transition ? .45 + .55 * blend : 1;
  featurePairs.forEach((pair, index) => {
    const target = index === activeChapter ? 1 : 0;
    const from = transition?.from[index];
    const opacity = from ? MathUtils.lerp(from.opacity, target, blend) : target;
    const shift = from ? MathUtils.lerp(from.y, target ? 0 : -18 * transition.direction, blend) : 0;
    pairStates[index] = { opacity, y: shift };
    setStyle(pair, 'content-visibility', opacity > 0 || preparedPairs.has(index) ? 'visible' : 'hidden');
    setStyle(pair, 'opacity', opacity.toFixed(3));
    setStyle(pair, 'transform', `translateY(${shift.toFixed(1)}px)`);
    // Keep the existing fade and displacement. Filtering the entire text pair
    // created a new offscreen surface at each chapter change; the resting
    // appearance, typography and glass backgrounds are unchanged.
    setStyle(pair, 'filter', 'none');
  });
  setStyle(fallbackImage, '--screen-brightness', screenBrightness.toFixed(3));
  if (fraction === 1) chapterTransition = null;
  stage.dataset.transitioning = String(Boolean(chapterTransition));
}

function applyChapter(scrollProgress = 0) {
  readingProgress = scrollProgress;
  const chapterPosition=scrollProgress*4,following=Math.floor(chapterPosition)+1;
  if(following<4&&chapterPosition%1>=.65)preparedPairs.add(following);
  prepareScreens(targetRaw, scrollProgress);
  // Exact same quarters as the four visible progress segments, both ways.
  const nextIndex = Math.min(3, Math.floor(scrollProgress * 4));
  chapterBars.forEach((bar, index) => setStyle(bar, '--fill', MathUtils.clamp(scrollProgress * 4 - index, 0, 1).toFixed(6)));
  const percent = (scrollProgress * 100).toFixed(2);
  if (chapterRail.getAttribute('aria-valuenow') !== percent) chapterRail.setAttribute('aria-valuenow', percent);
  if (activeChapter !== nextIndex || chapterRail.getAttribute('aria-valuetext') !== `Tela ${nextIndex + 1} de 4`) {
    const time = performance.now();
    advanceChapter(time);
    const direction = nextIndex > activeChapter ? 1 : -1;
    chapterTransition = reduced.matches ? null : {
      start: time, direction,
      from: pairStates.map((state, index) => ({ ...state, y: state.opacity === 0 && index === nextIndex ? 18 * direction : state.y }))
    };
    activeChapter = nextIndex;
    screenIndex = nextIndex;
    stage.dataset.chapter = String(nextIndex + 1);
    chapterRail.setAttribute('aria-valuetext', `Tela ${nextIndex + 1} de 4`);
    chapterCount.textContent = `${String(nextIndex + 1).padStart(2, '0')} / 04`;
    featurePairs.forEach((pair, index) => {
      const inactive = index !== nextIndex;
      pair.inert = inactive;
      if (inactive) pair.setAttribute('aria-hidden', 'true');
      else pair.removeAttribute('aria-hidden');
    });
    if (targetRaw >= .20 && fallbackScreens[nextIndex]) loadScreen(nextIndex).then(image => { if(activeChapter === nextIndex) fallbackImage.src = image.src; }).catch(() => {});
  }
  if (reduced.matches) chapterTransition = null;
  advanceChapter();
}

function applyProgress(raw, { time = performance.now(), settle = false, exact = false } = {}) {
  visualRaw = exact ? raw : handoffMotion.sample(raw, time, { reduced: reduced.matches, settle });
  motion = transitionPose(visualRaw, reduced.matches);
  setData('exchanging', String(handoffMotion.active));
  progress = motion.approach;
  // Paint the changing pixels directly. Inherited stage variables invalidated
  // every text/panel descendant on each step, even when its pixels were still.
  setStyle(sceneShade, 'opacity', progress.toFixed(4));
  if (sceneProgressFill) setStyle(sceneProgressFill, 'transform', `scaleX(${(reduced.matches ? 1 : Math.min(raw / DOCK_AT, 1)).toFixed(4)})`);
  const exit = ease(MathUtils.clamp(raw / .17, 0, 1));
  setStyle(intro, 'opacity', (1 - exit).toFixed(3));
  const hideIntro = !reduced.matches && !compactLayout.matches && raw >= .17;
  if (lastIntroHidden !== hideIntro) {
    lastIntroHidden = hideIntro; intro.inert = hideIntro;
    if (hideIntro) intro.setAttribute('aria-hidden', 'true');
    else intro.removeAttribute('aria-hidden');
  }
  setData('phase', motion.exchange === 0 ? 'money' : motion.exchange < 1 ? 'handoff' : raw < DOCK_AT ? 'phone-reveal' : 'docked');
  setData('turn', (-motion.yaw * 180 / Math.PI).toFixed(1));
  setData('progress', raw.toFixed(4));
  setData('screen', motion.exchange >= .5 ? 'on' : 'off');
  // Prepared poses already own cash visibility; fallback layers are hidden.
  if (!lite) setStyle(stage, '--cash-visible', motion.exchange < .5 ? '1' : '0');
  if (!panelsPrepared && raw >= .30) {
    panelsPrepared = true;
    stage.classList.add('is-prepared');
    if (!compactLayout.matches && !reduced.matches) {
      panelEntranceAnimations = [...featurePairs[0].querySelectorAll('.glass-panel')].map((panel, index) => {
        const y = index ? -28 : 28;
        const animation = panel.animate([
          { transform: `translate(calc(${index ? '' : '-'}50vw ${index ? '+' : '-'} 100%),${y}px)` },
          { transform: `translate(0,${y}px)` }
        ], { duration: 1050, delay: index ? 100 : 0, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
        animation.pause(); animation.currentTime = 1151;
        return animation;
      });
    }
  }
  // The last 18% of the pinned scene is a still interval for reading the cards.
  const docked = (ready || failed) && (reduced.matches ? motion.exchange === 1 : raw >= DOCK_AT);
  if (lastDocked !== docked) {
    lastDocked = docked;
    stage.classList.toggle('is-docked', docked);
    if (docked) {
      panelEntranceAnimations.forEach(animation => {
        if (reduced.matches || compactLayout.matches) { animation.pause(); animation.currentTime = 1151; }
        else { animation.currentTime = 0; animation.play(); }
      });
      document.dispatchEvent(new CustomEvent('parcelo:panels-arriving', { detail: { duration: compactLayout.matches ? 520 : 1170 } }));
      features.removeAttribute('aria-hidden');
      chapterRail.removeAttribute('aria-hidden');
    } else {
      panelEntranceAnimations.forEach(animation => { animation.pause(); animation.currentTime = 1151; });
      features.setAttribute('aria-hidden', 'true');
      chapterRail.setAttribute('aria-hidden', 'true');
    }
    // updateScroll updates navigation with positions read before these writes.
  }
}

function updateScroll(queue = true, immediate = false) {
  // Read layout together before changing styles or attributes.
  const sceneRect = experience.getBoundingClientRect();
  const scrolled = Math.max(0, -sceneRect.top);
  const travel = approachTravel();
  const storyBounds = storiesSection.getBoundingClientRect();
  const footerVisible = footer.getBoundingClientRect().top < innerHeight;
  const sectionTops = navigationSections.map(section => section.getBoundingClientRect().top);
  targetRaw = travel > 0 ? MathUtils.clamp(scrolled / travel, 0, 1) : 1;
  // Include the reading holds, from the first docked frame to sticky release.
  const chapterStart = travel * (reduced.matches ? HANDOFF_AT : DOCK_AT);
  const chapterTravel = Math.max(1, sceneRect.height - height - chapterStart);
  applyChapter(MathUtils.clamp((scrolled - chapterStart) / chapterTravel, 0, 1));
  if (immediate) { chapterTransition = null; advanceChapter(); }
  displayedRaw = targetRaw;
  applyProgress(displayedRaw, { settle: immediate || !inView });
  // At the reading dock the backdrop is the opaque #020e0b shade. Blurring
  // and saturating that uniform color needs no repeated sampling pass.
  const opaqueBackdrop = targetRaw >= DOCK_AT && sceneRect.top <= 0 && sceneRect.bottom >= height;
  clearTimeout(opaqueBackdropTimer);
  if (!opaqueBackdrop) document.documentElement.classList.remove('is-opaque-hero');
  else if (!document.documentElement.classList.contains('is-opaque-hero')) {
    // Keep the already rastered navigation during arrival. Consolidate its
    // uniform backdrop only after the wheel and the panel entrance are quiet.
    opaqueBackdropTimer = setTimeout(() => document.documentElement.classList.add('is-opaque-hero'), 1250);
  }
  updateNavigation(sectionTops);
  qr.classList.toggle('is-opening-hidden', !lastDocked && sceneRect.bottom > 0);
  qr.classList.toggle('is-muted', !compactLayout.matches && (footerVisible || (targetRaw > .67 && sceneRect.bottom > 0) || (storyBounds.top < innerHeight && storyBounds.bottom > 0)));
  if (queue) requestRender(false);
}

function render(time = 0) {
  if (!ready || failed || !layout) return false;
  // Keep the four reading screens sharp. During the spin, a lower raster
  // density avoids spending the frame budget on detail that is moving.
  // Hysteresis prevents reallocating buffers when scrolling around arrival.
  if (reduced.matches || progress >= .999) readingResolution = true;
  else if (progress < .98) readingResolution = false;
  setSceneResolution();
  const pixels = MathUtils.lerp(layout.startHeight, layout.endHeight, progress);
  const distance = layout.focal / pixels;
  const x = MathUtils.lerp(layout.startX, width / 2, progress);
  const y = MathUtils.lerp(layout.startY, layout.endY, progress);
  // Reuse the rendered layer for the tiny decorative float. No geometry,
  // lighting or screen pixels change while the reader is standing still.
  updateFloat(reduced.matches ? 0 : pixels * .008 * (1 - progress));
  const px = (x - width / 2) / pixels;
  // Account for perspective: the exchange is edge-on to the viewer even
  // while the shared object is still to the right of the camera's center.
  const yaw = motion.yaw - Math.atan2(px, distance) * motion.edge;
  const pose = [px, (height / 2 - y) / pixels, camera.position.z - distance, motion.pitch, yaw, motion.roll, (motion.exchange >= .5 ? screenBrightness : 0), screenIndex, motion.exchange, motion.compress];
  if (!needsRender && lastPose && pose.every((value, index) => value === lastPose[index])) return false;
  phone.position.set(pose[0], pose[1], pose[2]);
  phone.rotation.set(pose[3], pose[4], pose[5]);
  handoff.value = motion.exchange;
  moneyModel.visible = motion.exchange < 1;
  phoneModel.visible = motion.exchange > 0;
  moneyModel.scale.z = motion.compress;
  screenMaterial.color.setScalar(pose[6]);
  if (screenMaterial.map !== screenTextures[pose[7]]) {
    screenMaterial.map = screenTextures[pose[7]];
  }
  renderer.render(scene, camera);
  lastPose = pose; needsRender = false;
  return true;
}

function updateFloat(amplitude) {
  amplitude = Math.round(amplitude * 1000) / 1000;
  if (floatAmplitude !== amplitude) {
    floatAmplitude = amplitude;
    // Use numeric transforms on the existing layer, without a JavaScript
    // animation loop or CSS variables inside the animated keyframes.
    const keyframes = Array.from({ length: 33 }, (_, index) => ({
      transform: `translateY(${(-Math.sin(index * Math.PI / 16) * amplitude).toFixed(4)}px)`
    }));
    if (floatAnimation) floatAnimation.effect.setKeyframes(keyframes);
    else floatAnimation = renderer.domElement.animate(keyframes, { duration: 2 * Math.PI / .0009, iterations: Infinity });
  }
  updateFloatPlayback();
}

function updateFloatPlayback() {
  if (!floatAnimation) return;
  const playing = ready && !failed && inView && !document.hidden && !reduced.matches && progress < .999;
  if (playing && floatAnimation.playState !== 'running') floatAnimation.play();
  else if (!playing && floatAnimation.playState !== 'paused') floatAnimation.pause();
}

function tick(time) {
  frame = 0;
  if (document.hidden) return;
  if (scrollDirty) { scrollDirty = false; updateScroll(false); }
  if (chapterTransition) {
    advanceChapter(time);
    if (chapterTransition) requestRender(false);
  }
  const handoffAnimating = handoffMotion.active;
  if (handoffAnimating) {
    applyProgress(displayedRaw, { time });
    if (handoffMotion.active) requestRender(false);
    else needsRender = true; // Present the final clean model even between render slots.
  }
  if (lite) { if (inView) paintLite(); needsRender = false; return; }
  if (!inView || !ready || failed) return;
  const movingRaw = Math.abs(targetRaw - displayedRaw) > .00005;
  const screenChanged = !lastPose || screenIndex !== lastPose[7] || (motion.exchange >= .5 ? screenBrightness : 0) !== lastPose[6];
  const moving = movingRaw || screenChanged || handoffAnimating;
  monitorMotion(time, moving);
  if (lite) return;
  if (movingRaw) {
    const delta = Math.min(50, Math.max(1, time - (lastTick || time - 16)));
    const blend = 1 - Math.exp(-delta / 70);
    displayedRaw = MathUtils.lerp(displayedRaw, targetRaw, blend);
    if (Math.abs(targetRaw - displayedRaw) < .00005) displayedRaw = targetRaw;
    if (movingRaw) applyProgress(displayedRaw, { time });
  }
  lastTick = time;
  const interval = 1000 / (moving ? 60 : 30);
  const elapsed = time - lastFrame;
  if (needsRender || (movingRaw && displayedRaw === targetRaw) || elapsed >= interval - .5) {
    const forced = needsRender;
    render(time);
    // Preserve the fractional frame budget on 90/120/144Hz displays.
    lastFrame = forced ? time : lastFrame + Math.max(1, Math.floor((elapsed + .5) / interval)) * interval;
  }
  // Never drop the last chapter update when it lands between two GPU frames.
  const pendingScreen = !lastPose || screenIndex !== lastPose[7] || (motion.exchange >= .5 ? screenBrightness : 0) !== lastPose[6];
  if (pendingScreen || handoffMotion.active || (!reduced.matches && movingRaw)) requestRender(false);
}
function requestRender(force = true) {
  if (force) needsRender = true;
  if (document.hidden) return;
  if (!frame && (scrollDirty || chapterTransition || (handoffMotion.active && inView) || (lite && inView && needsRender) || (ready && inView && !failed))) frame = requestAnimationFrame(tick);
}
function setSceneResolution() {
  const crop = layout.crop;
  const density = Math.min(devicePixelRatio || 1, readingResolution ? 2 : 1.5);
  const pixelRatio = Math.min(density, Math.sqrt(MAX_SCENE_PIXELS / (crop.width * crop.height)));
  const key = [crop.width, crop.height, pixelRatio].join(':');
  if (key === bufferSize) return;
  bufferSize = key;
  renderer.setDrawingBufferSize(crop.width, crop.height, pixelRatio);
  transmissionWidth.value = Math.floor(width * pixelRatio);
  needsRender = true;
}
function resize(force = false) {
  placeFeatures();
  if (lite) { updateScroll(false, true); paintLite(); return; }
  if (!modelHalfSize) return;
  const density = Math.min(devicePixelRatio || 1, 2);
  const key = [width, height, density].join(':');
  if (force !== true && key === previousSize) return;
  previousSize = key;
  layout = sceneLayout(width, height, compactLayout.matches, modelHalfSize, moneyHalfSize);
  const crop = layout.crop;
  setStyle(stage, '--cash-x', layout.startX + 'px');
  setStyle(stage, '--cash-y', layout.startY + 'px');
  setStyle(stage, '--cash-width', (layout.startHeight * 1.33) + 'px');
  // Preserve the existing camera crop and CSS size; cap only its raster density.
  if (force === true) bufferSize = '';
  setSceneResolution();
  Object.assign(renderer.domElement.style, { position: 'absolute', left: crop.x + 'px', top: crop.y + 'px', width: crop.width + 'px', height: crop.height + 'px' });
  camera.setViewOffset(width, height, crop.x, crop.y, crop.width, crop.height);
  setStyle(stage, '--dock-phone-width', (layout.endHeight * (.0776 / .1628)) + 'px');
  updateScroll(false);
  requestRender();
}

function restoreStudioEnvironment() {
  environmentTarget?.dispose();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  environmentTarget = pmrem.fromScene(room, .06);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .35;
  scene.environmentRotation.set(0, 1.7, .2);
  room.dispose(); pmrem.dispose();
}

function prepareScreenTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  const repeat = (.07485 / .16005) / (texture.image.width / texture.image.height);
  texture.repeat.set(repeat, 1);
  texture.offset.set((1 - repeat) / 2, 0);
}

function applyHandoffMaterial(root, isCash) {
  const seen = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      const previousCompile = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, webgl) => {
        previousCompile.call(material, shader, webgl);
        shader.uniforms.parceloHandoff = handoff;
        shader.fragmentShader = 'uniform float parceloHandoff;\n' + shader.fragmentShader;
        // Complementary opaque coverage avoids transparent stacks and the
        // sorting artifacts of blending 100 individual paper layers.
        shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
          #include <clipping_planes_fragment>
          if (parceloHandoff > 0.0 && parceloHandoff < 1.0) {
          float coverage = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(.06711056, .00583715))));
          if (${isCash ? 'coverage < parceloHandoff' : 'coverage >= parceloHandoff'}) discard;
          }
        `);
      };
      material.customProgramCacheKey = () => previousKey + '-cash-handoff-v1-' + isCash;
      if (isCash && material.map) material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.needsUpdate = true;
    }
  });
}

async function initialize() {
  if (reduced.matches || navigator.connection?.saveData) { activateLite(reduced.matches ? 'reduced-motion' : 'save-data'); return; }
  const canvas = document.createElement('canvas');
  const options = { alpha: true, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true };
  let context;
  try { context = canvas.getContext('webgl2', options); } catch { /* Use HTML if blocked. */ }
  if (!context) { activateLite('graphics-unavailable-or-slow'); return; }
  try {
    [THREE, { GLTFLoader }, { RoomEnvironment }, { batchStaticMeshes }] = await Promise.all([
      import('three'), import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/environments/RoomEnvironment.js'), import('./static-meshes.js')
    ]);
  } catch (error) { context.getExtension('WEBGL_lose_context')?.loseContext(); throw error; }
  if (lite) { context.getExtension('WEBGL_lose_context')?.loseContext(); return; }
  renderer = new THREE.WebGLRenderer({ ...options, canvas, context });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); if (!lite) activateLite('graphics-context-lost');
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .82;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  scene = new THREE.Scene();
  // Restrained neutral studio light on the original physical materials only.
  restoreStudioEnvironment();
  scene.add(new THREE.HemisphereLight(0xf0f2f4, 0x1b1d20, .4));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .65); rim.position.set(4, 2, -3); scene.add(rim);
  camera = new THREE.PerspectiveCamera(fov, 1, .05, 50);
  camera.position.z = 6;
  const { MeshoptDecoder } = await import('./vendor/meshopt/meshopt_decoder.module.js');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const moneyGltf = await loader.loadAsync('./models/maco-100-reais-meshopt.glb');
  const gltf = await loader.loadAsync('./models/galaxy-s25-ultra-meshopt.glb');
  const firstTexture = await new THREE.TextureLoader().loadAsync(screenSources[0]);
  const textures = Array(4).fill(firstTexture);
  if (lite) {
    const texturesToDispose = new Set(textures);
    for (const asset of [gltf.scene, moneyGltf.scene]) asset.traverse(object => {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        for (const value of Object.values(material)) if (value?.isTexture) texturesToDispose.add(value);
        material.dispose();
      }
    });
    texturesToDispose.forEach(texture => texture.dispose());
    return;
  }
  const asset = gltf.scene;
  const display = asset.getObjectByName('Phone_Display');
  if (!display?.isMesh) throw new Error('Phone_Display missing in the supplied model');
  screenTextures = textures;
  const texture = screenTextures[activeChapter];
  fallbackImage.src = fallbackScreens[activeChapter];
  screenTextures.forEach(prepareScreenTexture);
  const materials = new Map();
  asset.traverse(object => {
    if (!object.isMesh || object === display) return;
    const finish = original => {
      if (!materials.has(original)) {
        const material = original.clone();
        material.envMapIntensity = 1;
        material.toneMapped = true;
        material.side = THREE.FrontSide;
        if (material.transmission > 0) {
          const chunk = THREE.ShaderChunk.transmission_pars_fragment;
          const original = 'log2( transmissionSamplerSize.x )';
          if (!chunk.includes(original)) throw new Error('Unsupported transmission shader');
          material.onBeforeCompile = shader => {
            shader.uniforms.parceloFullTransmissionWidth = transmissionWidth;
            shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>', 'uniform float parceloFullTransmissionWidth;\n' + chunk.replace(original, 'log2( parceloFullTransmissionWidth )'));
          };
          material.customProgramCacheKey = () => 'parcelo-original-transmission-footprint-v1';
        }
        // Keep the GLB's titanium, frosted back and transmitting optical lenses.
        materials.set(original, material);
      }
      return materials.get(original);
    };
    object.material = Array.isArray(object.material) ? object.material.map(finish) : finish(object.material);
  });
  screenMaterial = new THREE.MeshBasicMaterial({ map: texture, color: 0x000000, toneMapped: false, side: THREE.FrontSide });
  display.material = screenMaterial;
  batchStaticMeshes(asset, { exclude: display });
  const bounds = new THREE.Box3().setFromObject(asset);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  modelHalfSize = { x: size.x / (2 * size.y), y: .5, z: size.z / (2 * size.y) };
  asset.position.sub(center);
  phone = new THREE.Group();
  const normalized = new THREE.Group();
  normalized.add(asset); normalized.scale.setScalar(1 / size.y);
  // The phone begins on the opposite side of the shared edge and finishes
  // facing front. The two intact models share one trajectory and pivot.
  phoneModel = new THREE.Group();
  phoneModel.rotation.y = Math.PI;
  phoneModel.add(normalized);
  phone.add(phoneModel);
  const cashAsset = moneyGltf.scene;
  batchStaticMeshes(cashAsset, { paperColors: true });
  cashAsset.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'ZXY');
  cashAsset.updateMatrixWorld(true);
  const cashBounds = new THREE.Box3().setFromObject(cashAsset);
  const cashSize = cashBounds.getSize(new THREE.Vector3());
  cashAsset.position.sub(cashBounds.getCenter(new THREE.Vector3()));
  const cashNormalized = new THREE.Group();
  cashNormalized.add(cashAsset);
  cashNormalized.scale.setScalar(1 / cashSize.y);
  moneyHalfSize = { x: cashSize.x / (2 * cashSize.y), y: .5, z: cashSize.z / (2 * cashSize.y) };
  moneyModel = new THREE.Group();
  moneyModel.add(cashNormalized);
  phone.add(moneyModel);
  scene.add(phone);
  applyHandoffMaterial(phoneModel, false);
  applyHandoffMaterial(moneyModel, true);
  // Child geometry never articulates: keep local transforms, update only the parent pose.
  normalized.traverse(object => { object.updateMatrix(); object.matrixAutoUpdate = false; });
  cashNormalized.traverse(object => { object.updateMatrix(); object.matrixAutoUpdate = false; });
  resize(true);
  screenTextures.forEach(item => renderer.initTexture(item));
  await renderer.compileAsync(scene, camera);
  if (lite) return;
  renderer.domElement.style.visibility = 'hidden';
  ready = true;
  const initialRaw = displayedRaw;
  applyProgress(HANDOFF_AT, { exact: true });
  render(0);
  await renderer.compileAsync(scene, camera);
  if (lite) return;
  applyProgress(initialRaw);
  needsRender = true;
  render(0);
  renderer.domElement.style.visibility = '';
  applyProgress(displayedRaw);
  updateScroll(false);
  requestRender();
  host.dataset.state = 'ready';
  host.dataset.mode = 'gpu'; document.documentElement.dataset.renderMode = 'gpu';
  monitoringAfter = performance.now() + 1200;
  updateFloatPlayback();
  host.dataset.model = 'maco-100-reais + galaxy-s25-ultra';

  requestRender();
}

placeFeatures();
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting; lastMotionTick = 0; qualitySamples = []; poorWindows = 0;
  updateFloatPlayback();
  if (inView) { updateScroll(false, true); requestRender(); }
  else { cancelAnimationFrame(frame); frame = 0; }
}).observe(stage);
// Reveal only the text on this scene; the photograph remains continuously visible.
document.documentElement.classList.add('reveal-ready');
const interludeObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) { interlude.classList.add('is-visible'); interludeObserver.disconnect(); }
}, { threshold: .16 });
interludeObserver.observe(interlude);
window.addEventListener('scroll', () => { scrollDirty = true; requestRender(false); }, { passive: true });
compactLayout.addEventListener('change', () => { placeFeatures(); updateScroll(); resize(true); });
reduced.addEventListener('change', () => { if (reduced.matches) activateLite('reduced-motion'); updateScroll(); resize(true); requestRender(); });
document.addEventListener('visibilitychange', () => {
  lastMotionTick = 0; qualitySamples = []; poorWindows = 0;
  updateFloatPlayback();
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
  else requestRender();
});
// Prepared original-model poses are the stable presentation for this visit.
// GPU initialization is retained for controlled comparisons, never the scroll path.
activateLite('prepared-first');

function updateNavigation(sectionTops = navigationSections.map(section => section.getBoundingClientRect().top)) {
  let current = lastDocked ? 'secao-2' : 'secao-1';
  navigationSections.forEach((section, index) => { if (sectionTops[index] <= innerHeight * .45) current = section.id; });
  if (activeSection === current) return;
  activeSection = current;
  for (const link of navigationLinks) {
    if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
document.addEventListener('parcelo:navigation-jump', () => updateScroll(true, true));
for (const link of document.querySelectorAll('[data-focus-phone]')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    const top = scrollY + experience.getBoundingClientRect().top + approachTravel() * DOCK_AT + 1;
    window.scrollTo({ top, behavior: 'instant' });
    updateScroll(true, true);
    history.replaceState(null, '', '#secao-2');
  });
}
