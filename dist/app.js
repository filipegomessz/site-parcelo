import * as THREE from 'three';
import { batchStaticMeshes } from './static-meshes.js';
import { sceneLayout } from './phone-layout.js';
import { transitionPose, HANDOFF_AT, DOCK_AT } from './money-transition.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const experience = document.querySelector('.scene-track');
const intro = document.querySelector('.hero-intro');
const stage = document.querySelector('.stage');
const host = document.querySelector('.phone-scene');
const features = document.querySelector('.feature-layout');
const featurePairs = [...features.querySelectorAll('.feature-pair')];
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
let renderer, scene, camera, phone, phoneModel, moneyModel, screenMaterial, environmentTarget;
let moneyHalfSize, motion = transitionPose(0);
const handoff = { value: 0 };
const screenSources = [
  './Imagens/app-home.jpg',
  './Imagens/app-cartoes-parcelas.jpg',
  './Imagens/app-compromissos-informais.jpg',
  './Imagens/app-pra-cancelar.jpg',
];
let screenTextures = [];
const fallbackScreens = screenSources;
let frame = 0, lastFrame = 0, lastTick = 0, progress = 0, width = 0, height = 0;
let targetRaw = 0, displayedRaw = 0;
let screenBrightness = 1, screenIndex = 0, activeChapter = 0;
let chapterTransition = null;
const pairStates = featurePairs.map((_, index) => ({ opacity: index === 0 ? 1 : 0, y: 0 }));
let layout, modelHalfSize, scrollDirty = false, needsRender = true, lastPose;
let previousSize = '', activeSection = '', lastDocked, lastIntroHidden;
const transmissionWidth = { value: 1 };
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
  const fraction = transition ? THREE.MathUtils.clamp((time - transition.start) / 380, 0, 1) : 1;
  const blend = 1 - Math.pow(1 - fraction, 3);
  screenBrightness = transition ? .45 + .55 * blend : 1;
  featurePairs.forEach((pair, index) => {
    const target = index === activeChapter ? 1 : 0;
    const from = transition?.from[index];
    const opacity = from ? THREE.MathUtils.lerp(from.opacity, target, blend) : target;
    const shift = from ? THREE.MathUtils.lerp(from.y, target ? 0 : -18 * transition.direction, blend) : 0;
    pairStates[index] = { opacity, y: shift };
    setStyle(pair, 'content-visibility', opacity > 0 ? 'visible' : 'hidden');
    setStyle(pair, '--pair-opacity', opacity.toFixed(3));
    setStyle(pair, '--pair-y', shift.toFixed(1) + 'px');
    setStyle(pair, '--pair-blur', (reduced.matches ? 0 : (1 - opacity) * 4).toFixed(1) + 'px');
  });
  setStyle(fallbackImage, '--screen-brightness', screenBrightness.toFixed(3));
  if (fraction === 1) chapterTransition = null;
  stage.dataset.transitioning = String(Boolean(chapterTransition));
}

function applyChapter(scrollProgress = 0) {
  // Exact same quarters as the four visible progress segments, both ways.
  const nextIndex = Math.min(3, Math.floor(scrollProgress * 4));
  chapterBars.forEach((bar, index) => setStyle(bar, '--fill', THREE.MathUtils.clamp(scrollProgress * 4 - index, 0, 1).toFixed(6)));
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
    if (fallbackScreens[nextIndex]) fallbackImage.src = fallbackScreens[nextIndex];
  }
  if (reduced.matches) chapterTransition = null;
  advanceChapter();
}

function applyProgress(raw) {
  motion = transitionPose(raw, reduced.matches);
  progress = motion.approach;
  setStyle(stage, '--progress', progress.toFixed(4));
  setStyle(stage, '--scroll-progress', (reduced.matches ? 1 : Math.min(raw / DOCK_AT, 1)).toFixed(4));
  const exit = ease(THREE.MathUtils.clamp(raw / .17, 0, 1));
  setStyle(intro, '--intro-opacity', (1 - exit).toFixed(3));
  setStyle(intro, '--intro-exit', exit.toFixed(3));
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
  setStyle(stage, '--cash-visible', motion.exchange < .5 ? '1' : '0');
  // The last 18% of the pinned scene is a still interval for reading the cards.
  const docked = (ready || failed) && (reduced.matches ? motion.exchange === 1 : raw >= DOCK_AT);
  if (lastDocked !== docked) {
    lastDocked = docked;
    stage.classList.toggle('is-docked', docked);
    features.inert = !docked;
    if (docked) {
      features.removeAttribute('aria-hidden');
      chapterRail.removeAttribute('aria-hidden');
    } else {
      features.setAttribute('aria-hidden', 'true');
      chapterRail.setAttribute('aria-hidden', 'true');
    }
    // Follow the visible phone and copy, including the smoothed approach.
    updateNavigation();
  }
}

function updateScroll(queue = true, immediate = false) {
  // Read layout together before changing any styles or attributes.
  const sceneRect = experience.getBoundingClientRect();
  const scrolled = Math.max(0, -sceneRect.top);
  const travel = approachTravel();
  const storyBounds = storiesSection.getBoundingClientRect();
  const footerVisible = footer.getBoundingClientRect().top < innerHeight;
  const sectionTops = navigationSections.map(section => section.getBoundingClientRect().top);
  targetRaw = travel > 0 ? THREE.MathUtils.clamp(scrolled / travel, 0, 1) : 1;
  // Include the reading holds, from the first docked frame to sticky release.
  const chapterStart = travel * (reduced.matches ? HANDOFF_AT : DOCK_AT);
  const chapterTravel = Math.max(1, sceneRect.height - height - chapterStart);
  applyChapter(THREE.MathUtils.clamp((scrolled - chapterStart) / chapterTravel, 0, 1));
  if (immediate) { chapterTransition = null; advanceChapter(); }
  if (immediate || !ready || failed || reduced.matches || !inView) {
    displayedRaw = targetRaw; applyProgress(displayedRaw);
  }
  updateNavigation(sectionTops);
  qr.classList.toggle('is-opening-hidden', !lastDocked && sceneRect.bottom > 0);
  qr.classList.toggle('is-muted', !compactLayout.matches && (footerVisible || (targetRaw > .67 && sceneRect.bottom > 0) || (storyBounds.top < innerHeight && storyBounds.bottom > 0)));
  if (queue) requestRender(false);
}

function render(time = 0) {
  if (!ready || failed || !layout) return false;
  const pixels = THREE.MathUtils.lerp(layout.startHeight, layout.endHeight, progress);
  const distance = layout.focal / pixels;
  const x = THREE.MathUtils.lerp(layout.startX, width / 2, progress);
  const y = THREE.MathUtils.lerp(layout.startY, layout.endY, progress);
  const float = reduced.matches ? 0 : Math.sin(time * .0009) * .008 * (1 - progress);
  const px = (x - width / 2) / pixels;
  // Account for perspective: the exchange is edge-on to the viewer even
  // while the shared object is still to the right of the camera's center.
  const yaw = motion.yaw - Math.atan2(px, distance) * motion.edge;
  const pose = [px, (height / 2 - y) / pixels + float, camera.position.z - distance, motion.pitch, yaw, motion.roll, (motion.exchange >= .5 ? screenBrightness : 0), screenIndex, motion.exchange, motion.compress];
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

function tick(time) {
  frame = 0;
  if (document.hidden) return;
  if (scrollDirty) { scrollDirty = false; updateScroll(false); }
  if (chapterTransition) {
    advanceChapter(time);
    if (chapterTransition) requestRender(false);
  }
  if (!inView || !ready || failed) return;
  const movingRaw = Math.abs(targetRaw - displayedRaw) > .00005;
  const screenChanged = !lastPose || screenIndex !== lastPose[7] || (motion.exchange >= .5 ? screenBrightness : 0) !== lastPose[6];
  const moving = movingRaw || screenChanged;
  if (movingRaw) {
    const delta = Math.min(50, Math.max(1, time - (lastTick || time - 16)));
    const blend = 1 - Math.exp(-delta / 70);
    displayedRaw = THREE.MathUtils.lerp(displayedRaw, targetRaw, blend);
    if (Math.abs(targetRaw - displayedRaw) < .00005) displayedRaw = targetRaw;
    if (movingRaw) applyProgress(displayedRaw);
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
  if (pendingScreen || (!reduced.matches && (movingRaw || progress < .999))) requestRender(false);
}
function requestRender(force = true) {
  if (force) needsRender = true;
  if (document.hidden) return;
  if (!frame && (scrollDirty || chapterTransition || (ready && inView && !failed))) frame = requestAnimationFrame(tick);
}
function resize(force = false) {
  placeFeatures();
  if (!modelHalfSize) return;
  const pixelRatio = Math.min(Math.max(devicePixelRatio, 2), width <= 900 ? 2.5 : 3);
  const key = [width, height, pixelRatio].join(':');
  if (force !== true && key === previousSize) return;
  previousSize = key;
  layout = sceneLayout(width, height, compactLayout.matches, modelHalfSize, moneyHalfSize);
  const crop = layout.crop;
  setStyle(stage, '--cash-x', layout.startX + 'px');
  setStyle(stage, '--cash-y', layout.startY + 'px');
  setStyle(stage, '--cash-width', (layout.startHeight * 1.33) + 'px');
  // Same pixels per CSS pixel; only empty space is removed from the buffer.
  renderer.setDrawingBufferSize(crop.width, crop.height, pixelRatio);
  Object.assign(renderer.domElement.style, { position: 'absolute', left: crop.x + 'px', top: crop.y + 'px', width: crop.width + 'px', height: crop.height + 'px' });
  camera.setViewOffset(width, height, crop.x, crop.y, crop.width, crop.height);
  transmissionWidth.value = Math.floor(width * pixelRatio);
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
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
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
  const [gltf, textures, moneyGltf] = await Promise.all([
    new GLTFLoader().loadAsync('./models/galaxy-s25-ultra.glb'),
    Promise.all(screenSources.map(source => new THREE.TextureLoader().loadAsync(source))),
    new GLTFLoader().loadAsync('./models/maco-100-reais.glb'),
  ]);
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
  renderer.domElement.style.visibility = 'hidden';
  ready = true;
  const initialRaw = displayedRaw;
  applyProgress(HANDOFF_AT);
  render(0);
  await renderer.compileAsync(scene, camera);
  applyProgress(initialRaw);
  needsRender = true;
  render(0);
  renderer.domElement.style.visibility = '';
  applyProgress(displayedRaw);
  updateScroll(false);
  requestRender();
  host.dataset.state = 'ready';
  host.dataset.model = 'maco-100-reais + galaxy-s25-ultra';
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) requestRender(); else { cancelAnimationFrame(frame); frame = 0; } }).observe(stage);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); failed = true; cancelAnimationFrame(frame); frame = 0; host.dataset.state = 'error';
    applyProgress(targetRaw);
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    try {
      restoreStudioEnvironment();
      failed = false; resize(true); host.dataset.state = 'ready'; requestRender();
    } catch (error) {
      failed = true; host.dataset.state = 'error'; console.error('Parcelo 3D restore:', error);
    }
  });
  requestRender();
}

placeFeatures();
// Reveal only the text on this scene; the photograph remains continuously visible.
document.documentElement.classList.add('reveal-ready');
const interludeObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) { interlude.classList.add('is-visible'); interludeObserver.disconnect(); }
}, { threshold: .16 });
interludeObserver.observe(interlude);
window.addEventListener('scroll', () => { scrollDirty = true; requestRender(false); }, { passive: true });
compactLayout.addEventListener('change', () => { placeFeatures(); updateScroll(); resize(true); });
reduced.addEventListener('change', () => { updateScroll(); resize(true); requestRender(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
  else requestRender();
});
initialize().catch(error => { failed = true; host.dataset.state = 'error'; updateScroll(); console.error('Parcelo 3D:', error); });

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
updateScroll();
