const gallery = document.querySelector('.story-gallery');
const reflectionObserver=new IntersectionObserver(([entry])=>{
  if(entry.isIntersecting){gallery.closest('.stories-section').classList.add('is-near');reflectionObserver.disconnect();}
},{rootMargin:'100% 0px'});
reflectionObserver.observe(gallery.closest('.stories-section'));
const frames = [...gallery.querySelectorAll('.story-frame')];
const reduced = matchMedia('not all') /* full motion for everyone, owner's decision 07/10/26 */;
const arrow = direction => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction === 'left' ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6'}"/></svg>`;
function button(label, icon) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'story-control';
  element.setAttribute('aria-label', label);
  element.innerHTML = icon;
  return element;
}

// Native dialog keeps keyboard focus inside the reader and supports Escape.
const viewer = document.createElement('dialog');
viewer.className = 'story-viewer';
viewer.setAttribute('aria-labelledby', 'story-viewer-label');
const toolbar = document.createElement('div');
toolbar.className = 'story-viewer-toolbar';
const label = document.createElement('p');
label.id = 'story-viewer-label';
label.setAttribute('aria-live', 'polite');
const previous = button('Story anterior', arrow('left'));
const next = button('Próximo story', arrow('right'));
const close = button('Fechar stories', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>');
const content = document.createElement('div');
content.className = 'story-viewer-frame';
toolbar.append(label, previous, next, close);
viewer.append(toolbar, content);
document.body.append(viewer);
let current = 0;
let opener;
function show(index) {
  current = Math.max(0, Math.min(frames.length - 1, index));
  const clone = frames[current].cloneNode(true);
  clone.querySelector('.story-open')?.remove();
  clone.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
  content.replaceChildren(clone);
  label.textContent = `Story ${current + 1} de ${frames.length}`;
  previous.disabled = current === 0;
  next.disabled = current === frames.length - 1;
  viewer.scrollTop = 0;
  // A focused arrow can become disabled on the first/last story.
  if (document.activeElement === previous && previous.disabled) next.focus();
  if (document.activeElement === next && next.disabled) previous.focus();
}
frames.forEach((frame, index) => {
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'story-open';
  // Accessible labels need text only. innerText forced layout after each
  // appended button, rebuilding the page four times during hero startup.
  const description = frame.querySelector('.story-copy')?.textContent.replace(/\s+/g, ' ').trim() || frame.querySelector('.story-content img')?.alt;
  open.setAttribute('aria-label', `Ampliar story ${index + 1}${description ? ': ' + description : ' do Parcelô'}`);
  open.setAttribute('aria-haspopup', 'dialog');
  open.addEventListener('click', () => {
    opener = open;
    show(index);
    viewer.showModal();
    document.body.classList.add('is-story-open');
    close.focus({ preventScroll: true });
  });
  frame.append(open);
});
previous.addEventListener('click', () => show(current - 1));
next.addEventListener('click', () => show(current + 1));
close.addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => { document.body.classList.remove('is-story-open'); content.replaceChildren(); opener?.focus({ preventScroll: true }); });
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
viewer.addEventListener('click', event => {
  const bounds = viewer.getBoundingClientRect();
  if (event.target === viewer && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) viewer.close();
});

const tools = document.createElement('div');
tools.className = 'story-tools';
const hint = document.createElement('p');
hint.textContent = 'Clique ou toque para ampliar.';
const controls = document.createElement('div');
controls.className = 'story-controls';
const scrollBack = button('Ver stories anteriores', arrow('left'));
const scrollNext = button('Ver próximos stories', arrow('right'));
controls.append(scrollBack, scrollNext);
tools.append(hint, controls);
gallery.after(tools);
function updateControls() {
  const end = gallery.scrollWidth - gallery.clientWidth;
  tools.dataset.overflow = String(end > 2);
  scrollBack.disabled = gallery.scrollLeft <= 2;
  scrollNext.disabled = gallery.scrollLeft >= end - 2;
}
function move(direction) {
  const gap = Number.parseFloat(getComputedStyle(gallery).columnGap) || 0;
  gallery.scrollBy({ left: direction * (frames[0].offsetWidth + gap), behavior: reduced.matches ? 'instant' : 'smooth' });
}
scrollBack.addEventListener('click', () => move(-1));
scrollNext.addEventListener('click', () => move(1));
gallery.addEventListener('scroll', updateControls, { passive: true });
new ResizeObserver(updateControls).observe(gallery);
// ResizeObserver supplies the first measurement after the DOM writes settle.
