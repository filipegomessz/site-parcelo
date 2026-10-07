// Keep ordinary page controls independent of the 3D scene loading.
const motionPreference = matchMedia('not all') /* full motion for everyone, owner's decision 07/10/26 */;
const questions = [...document.querySelectorAll('.faq-item')];
const faqStates = new Map();

function finishQuestion(question, state) {
  state.heightAnimation?.cancel();
  state.answerAnimation?.cancel();
  state.heightAnimation = state.answerAnimation = null;
  question.open = state.expanded;
}

function setQuestionExpanded(question, expanded) {
  const state = faqStates.get(question);
  if (state.expanded === expanded) return;
  const height = question.getBoundingClientRect().height;
  const answerStyle = getComputedStyle(state.answer);
  const opacity = question.open ? answerStyle.opacity : '0';
  const transform = question.open ? answerStyle.transform : 'translateY(-6px)';
  state.heightAnimation?.cancel();
  state.answerAnimation?.cancel();
  state.expanded = expanded;
  question.dataset.faqExpanded = String(expanded);
  state.summary.setAttribute('aria-expanded', String(expanded));
  state.answer.inert = !expanded;
  state.answer.setAttribute('aria-hidden', String(!expanded));
  question.open = true;

  if (motionPreference.matches) {
    finishQuestion(question, state);
    return;
  }

  const questionStyle = getComputedStyle(question);
  const borders = parseFloat(questionStyle.borderTopWidth) + parseFloat(questionStyle.borderBottomWidth);
  const targetHeight = state.summary.getBoundingClientRect().height
    + (expanded ? state.answer.getBoundingClientRect().height : 0) + borders;
  const options = { duration: expanded ? 320 : 240, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' };
  state.heightAnimation = question.animate([{ height: `${height}px` }, { height: `${targetHeight}px` }], options);
  state.answerAnimation = state.answer.animate([
    { opacity, transform },
    { opacity: expanded ? 1 : 0, transform: expanded ? 'translateY(0)' : 'translateY(-6px)' }
  ], options);
  state.heightAnimation.onfinish = () => finishQuestion(question, state);
}

questions.forEach(question => {
  const summary = question.querySelector('summary');
  const answer = question.querySelector('.faq-answer');
  if (!question.animate || !answer || !summary) {
    question.addEventListener('toggle', () => {
      if (question.open) questions.forEach(other => { if (other !== question) other.open = false; });
    });
    return;
  }
  const state = { summary, answer, expanded: question.open, heightAnimation: null, answerAnimation: null };
  faqStates.set(question, state);
  // Native exclusive details would hide the previous answer before its closing motion.
  // Without JavaScript, the original shared name still provides exclusive disclosure.
  question.removeAttribute('name');
  question.classList.add('faq-enhanced');
  question.dataset.faqExpanded = String(state.expanded);
  summary.setAttribute('aria-expanded', String(state.expanded));
  answer.inert = !state.expanded;
  answer.setAttribute('aria-hidden', String(!state.expanded));
  summary.addEventListener('click', event => {
    event.preventDefault();
    const expanded = !state.expanded;
    if (expanded) faqStates.forEach((otherState, other) => {
      if (other !== question && otherState.expanded) setQuestionExpanded(other, false);
    });
    setQuestionExpanded(question, expanded);
  });
});

motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) faqStates.forEach((state, question) => finishQuestion(question, state));
});

const glassNavigation = document.querySelector('.glass-nav');
function initializeGlassNavigation() {
  if (!glassNavigation) return;
  const links = [...glassNavigation.querySelectorAll('a:not(.nav-brand)')];
  let panelEntranceUntil = 0, automaticLensTimer, scrollBusy = false, scrollQuietTimer;
  window.addEventListener('scroll', () => {
    scrollBusy = true;
    clearTimeout(scrollQuietTimer);
    scrollQuietTimer = setTimeout(() => { scrollBusy = false; followCurrentSection(); }, 180);
  }, { passive: true });
  document.addEventListener('parcelo:panels-arriving', event => {
    panelEntranceUntil = performance.now() + (event.detail?.duration || 0);
  });
  const lens = document.createElement('div');
  lens.className = 'nav-lens';
  lens.setAttribute('aria-hidden', 'true');
  const lensContent = document.createElement('div');
  // Raster the magnified labels once at their maximum scale; subsequent
  // automatic lens travel only downsamples this already prepared layer.
  const lensRasterScale = 1.25;
  lensContent.className = 'nav-lens-content';
  lens.append(lensContent);
  const labels = links.map(link => {
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = link.textContent;
    link.replaceChildren(label);
    const magnifiedLabel = document.createElement('span');
    magnifiedLabel.className = 'nav-lens-label';
    magnifiedLabel.textContent = label.textContent;
    lensContent.append(magnifiedLabel);
    return { link, label, magnifiedLabel };
  });
  glassNavigation.append(lens);

  let layout = new Map();
  let position = null;
  let destination = null;
  let animationFrame = 0;
  let selectedLink = links.find(link => link.hasAttribute('aria-current')) || links[0];
  let pendingLink = null;
  let pendingTimer = 0;
  let drag = null;
  let dragFrame = 0;
  let lensEnergy = 0;
  let lensDirection = 0;

  function paintLens(value, energy = 0, direction = 0) {
    position = value;
    lensEnergy = energy;
    lensDirection = direction;
    // The same optics, scoped to the moving pixels. Inherited variables on the
    // whole nav used to invalidate every descendant during the arrival.
    const zoom = 1.045 + energy * .175;
    const cx = value.x + value.width / 2, cy = value.y + value.height / 2;
    Object.assign(lens.style, {
      transform: `translate3d(${value.x}px,0,0) scaleY(${1 + energy * .09})`,
      top: `${value.y}px`, width: `${value.width}px`, height: `${value.height}px`
    });
    lens.style.setProperty('--lens-light', `${50 - direction * energy * 24}%`);
    lensContent.style.transformOrigin = '0 0';
    lensContent.style.transform = `translate3d(${-value.x + cx * (1 - zoom)}px,${-value.y + cy * (1 - zoom)}px,0) scale(${zoom/lensRasterScale})`;
    labels.forEach(({link,label}) => {
      const labelX = layout.get(link)?.labelX;
      if (labelX === undefined) return;
      const left=value.x-labelX, right=left+value.width;
      const mask=`linear-gradient(90deg,#000 ${left+3}px,transparent ${left+9}px,transparent ${right-9}px,#000 ${right-3}px)`;
      label.style.maskImage=mask;label.style.webkitMaskImage=mask;
    });
  }

  function moveLens(link, immediate = false) {
    const target = layout.get(link);
    if (!target) return;
    selectedLink = link;
    if (destination === target && !immediate) return;
    destination = target;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (!position || immediate || motionPreference.matches || document.hidden) {
      paintLens(target);
      return;
    }
    const from = { ...position };
    const distance = target.x - from.x;
    if (Math.abs(distance) < .5 && Math.abs(target.width - from.width) < .5) {
      paintLens(target);
      return;
    }
    const duration = Math.min(440, 340 + Math.abs(distance) * .22);
    const started = performance.now();
    const travelEnergy = Math.min(1, Math.abs(distance) / 65);
    const initialEnergy = lensEnergy;
    const direction = Math.sign(distance) || lensDirection;
    function tick(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const energy = Math.max(Math.sin(Math.PI * progress) * travelEnergy, initialEnergy * (1 - eased));
      const value = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, from[key] + (target[key] - from[key]) * eased]));
      // A small stretch in the direction of travel gives the lens a dragged-glass feel.
      const stretch = energy * Math.min(18, Math.abs(distance) * .08);
      value.x -= stretch / 2;
      value.width += stretch;
      paintLens(value, energy, direction);
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else { animationFrame = 0; paintLens(target); }
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function measureNavigation() {
    cancelDrag();
    const navBounds = glassNavigation.getBoundingClientRect();
    const originX = navBounds.left + glassNavigation.clientLeft;
    const originY = navBounds.top + glassNavigation.clientTop;
    const measurements = labels.map(item => ({
      ...item, bounds: item.link.getBoundingClientRect(), labelBounds: item.label.getBoundingClientRect(),
      font: getComputedStyle(item.link)
    }));
    layout = new Map();
    measurements.forEach(({ link, label, magnifiedLabel, bounds, labelBounds, font }) => {
      const box = { x: bounds.left - originX, y: bounds.top - originY, width: bounds.width, height: bounds.height, labelX: labelBounds.left - originX };
      layout.set(link, box);
      label.style.setProperty('--label-x', `${labelBounds.left - originX}px`);
      Object.assign(magnifiedLabel.style, {
        left: `${box.x*lensRasterScale}px`, top: `${box.y*lensRasterScale}px`, width: `${box.width*lensRasterScale}px`, height: `${box.height*lensRasterScale}px`,
        fontFamily: font.fontFamily, fontSize: `${parseFloat(font.fontSize)*lensRasterScale}px`, fontWeight: font.fontWeight,
        lineHeight: `${parseFloat(font.lineHeight)*lensRasterScale}px`, letterSpacing: font.letterSpacing==='normal'?'normal':`${parseFloat(font.letterSpacing)*lensRasterScale}px`,
        textShadow: `0 ${lensRasterScale}px ${5*lensRasterScale}px #00120ee6`
      });
    });
    lensContent.style.width = `${glassNavigation.clientWidth*lensRasterScale}px`;
    lensContent.style.height = `${glassNavigation.clientHeight*lensRasterScale}px`;
    moveLens(pendingLink || selectedLink, true);
    glassNavigation.classList.add('has-liquid-lens');
  }

  function followCurrentSection() {
    if (drag) return;
    const current = links.find(link => link.hasAttribute('aria-current')) || links[0];
    if (pendingLink && current !== pendingLink) return;
    if (!pendingLink && scrollBusy && !motionPreference.matches) return;
    clearTimeout(automaticLensTimer);
    // The active link changes immediately. Only its decorative glass travel
    // waits for the panels to finish, avoiding concurrent backdrop passes.
    const remaining=panelEntranceUntil-performance.now();
    if (!pendingLink && current.hash==='#secao-2' && remaining>0 && !motionPreference.matches) {
      automaticLensTimer=setTimeout(followCurrentSection,remaining+16);
      return;
    }
    pendingLink = null;
    clearTimeout(pendingTimer);
    moveLens(current);
  }

  function paintDrag() {
    dragFrame = 0;
    if (!drag?.moved) return;
    const first = layout.get(links[0]);
    const last = layout.get(links[links.length - 1]);
    const distance = drag.clientX - drag.startX;
    const energy = motionPreference.matches ? 0 : Math.min(1, Math.abs(distance) / 65);
    const stretch = energy * Math.min(18, Math.abs(distance) * .08);
    const center = drag.from.x + drag.from.width / 2 + distance;
    let baseWidth = last.width;
    let left = first;
    for (const link of links) {
      const right = layout.get(link);
      const leftCenter = left.x + left.width / 2;
      const rightCenter = right.x + right.width / 2;
      if (center <= rightCenter) {
        const blend = Math.max(0, Math.min(1, (center - leftCenter) / Math.max(1, rightCenter - leftCenter)));
        baseWidth = left.width + (right.width - left.width) * blend;
        break;
      }
      left = right;
    }
    const width = baseWidth + stretch;
    const x = Math.max(first.x, Math.min(last.x + last.width - width,
      drag.from.x + distance + (drag.from.width - width) * drag.grip));
    // Reuse the lens's magnification, lift, light and stretch; no layout reads while moving.
    paintLens({ ...drag.from, x, width }, energy, Math.sign(distance));
  }

  function stopDrag() {
    const previous = drag;
    drag = null;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    glassNavigation.classList.remove('is-lens-dragging');
    if (previous && lens.hasPointerCapture(previous.pointerId)) lens.releasePointerCapture(previous.pointerId);
    return previous;
  }

  function cancelDrag() {
    if (!drag) return;
    stopDrag();
    followCurrentSection();
  }

  lens.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0 || !position
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const bounds = glassNavigation.getBoundingClientRect();
    const originX = bounds.left + glassNavigation.clientLeft;
    const originY = bounds.top + glassNavigation.clientTop;
    drag = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      clientX: event.clientX, originX, originY, from: { ...position }, moved: false,
      grip: Math.max(0, Math.min(1, (event.clientX - originX - position.x) / position.width)),
      link: pendingLink || selectedLink
    };
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    destination = null;
    pendingLink = null;
    clearTimeout(pendingTimer);
    lens.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  lens.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.clientX = event.clientX;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    glassNavigation.classList.add('is-lens-dragging');
    // Coalesce high-frequency mouse/touch events into one paint per browser frame.
    if (!dragFrame) dragFrame = requestAnimationFrame(paintDrag);
  });

  lens.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.clientX = event.clientX;
    cancelAnimationFrame(dragFrame);
    if (drag.moved) paintDrag();
    const previous = stopDrag();
    const x = event.clientX - previous.originX;
    const y = event.clientY - previous.originY;
    const link = previous.moved ? links.find(item => {
      const box = layout.get(item);
      return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
    }) : previous.link;
    if (link && (!previous.moved || link !== previous.link)) {
      link.focus({ preventScroll: true });
      // Use the very same click route, including Section 2's phone landing point.
      link.click();
    } else followCurrentSection();
  });
  lens.addEventListener('pointercancel', cancelDrag);
  lens.addEventListener('lostpointercapture', cancelDrag);
  // Pointer capture keeps the browser's trailing click on the decorative lens.
  lens.addEventListener('click', event => event.preventDefault());
  window.addEventListener('blur', cancelDrag);

  glassNavigation.addEventListener('click', event => {
    const clicked = event.target.closest('a');
    if (!clicked || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = clicked.classList.contains('nav-brand') ? links[0] : clicked;
    if (!links.includes(link)) return;
    // The App link keeps its custom landing point in the 3D scene.
    if (!clicked.hasAttribute('data-focus-phone')) {
      const section = document.getElementById(clicked.hash.slice(1));
      if (!section) return;
      event.preventDefault();
      section.scrollIntoView({ behavior: 'instant', block: 'start' });
      if (location.hash !== clicked.hash) history.pushState(null, '', clicked.hash);
      document.dispatchEvent(new Event('parcelo:navigation-jump'));
    }
    pendingLink = link;
    clearTimeout(pendingTimer);
    moveLens(link);
    // Hold the clicked destination until the section state has caught up.
    pendingTimer = setTimeout(() => { pendingLink = null; followCurrentSection(); }, 1800);
  });

  function releaseNavigation() {
    if (drag) return;
    if (!pendingLink) return;
    pendingLink = null;
    clearTimeout(pendingTimer);
    followCurrentSection();
  }
  window.addEventListener('wheel', releaseNavigation, { passive: true });
  window.addEventListener('touchstart', releaseNavigation, { passive: true });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancelDrag();
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape'].includes(event.key)) releaseNavigation();
  });
  new MutationObserver(followCurrentSection).observe(glassNavigation, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  new ResizeObserver(measureNavigation).observe(glassNavigation);
  document.fonts.ready.then(measureNavigation);
  motionPreference.addEventListener('change', () => { cancelDrag(); moveLens(selectedLink, true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelDrag(); moveLens(selectedLink, true); }
  });
  measureNavigation();
}
// The opening pose can turn before decorative navigation is rastered. Set up
// the lens on a quiet frame, or immediately before a direct nav interaction.
if (glassNavigation) {
  let initialized = false, preparationTimer;
  const prepare = () => {
    if (initialized) return;
    initialized = true; clearTimeout(preparationTimer);
    window.removeEventListener('scroll', queuePreparation);
    glassNavigation.removeEventListener('pointerdown', prepare, true);
    glassNavigation.removeEventListener('focusin', prepare, true);
    initializeGlassNavigation();
  };
  const queuePreparation = () => { clearTimeout(preparationTimer); preparationTimer = setTimeout(prepare, 350); };
  window.addEventListener('scroll', queuePreparation, { passive: true });
  glassNavigation.addEventListener('pointerdown', prepare, true);
  glassNavigation.addEventListener('focusin', prepare, true);
  queuePreparation();
}
document.querySelectorAll('[data-current-year]').forEach(element => {
  element.textContent = String(new Date().getFullYear());
});
