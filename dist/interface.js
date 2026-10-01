// Keep ordinary page controls independent of the 3D scene loading.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
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
if (glassNavigation) {
  const links = [...glassNavigation.querySelectorAll('a:not(.nav-brand)')];
  const lens = document.createElement('div');
  lens.className = 'nav-lens';
  lens.setAttribute('aria-hidden', 'true');
  const lensContent = document.createElement('div');
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
    glassNavigation.style.setProperty('--lens-x', `${value.x}px`);
    glassNavigation.style.setProperty('--lens-width', `${value.width}px`);
    glassNavigation.style.setProperty('--lens-y', `${value.y}px`);
    glassNavigation.style.setProperty('--lens-height', `${value.height}px`);
    glassNavigation.style.setProperty('--lens-zoom', String(1.045 + energy * .175));
    glassNavigation.style.setProperty('--lens-lift', String(1 + energy * .09));
    glassNavigation.style.setProperty('--lens-light', `${50 - direction * energy * 24}%`);
    glassNavigation.style.setProperty('--lens-center-x', `${value.x + value.width / 2}px`);
    glassNavigation.style.setProperty('--lens-center-y', `${value.y + value.height / 2}px`);
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
      const box = { x: bounds.left - originX, y: bounds.top - originY, width: bounds.width, height: bounds.height };
      layout.set(link, box);
      label.style.setProperty('--label-x', `${labelBounds.left - originX}px`);
      Object.assign(magnifiedLabel.style, {
        left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`,
        fontFamily: font.fontFamily, fontSize: font.fontSize, fontWeight: font.fontWeight,
        lineHeight: font.lineHeight, letterSpacing: font.letterSpacing
      });
    });
    lensContent.style.width = `${glassNavigation.clientWidth}px`;
    lensContent.style.height = `${glassNavigation.clientHeight}px`;
    moveLens(pendingLink || selectedLink, true);
    glassNavigation.classList.add('has-liquid-lens');
  }

  function followCurrentSection() {
    if (drag) return;
    const current = links.find(link => link.hasAttribute('aria-current')) || links[0];
    if (pendingLink && current !== pendingLink) return;
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
document.querySelectorAll('[data-current-year]').forEach(element => {
  element.textContent = String(new Date().getFullYear());
});
