(() => {
  const button = document.querySelector('.pricing-cta-primary');
  const svg = button?.querySelector('.pricing-neon');
  const contour = svg?.querySelector('#pro-neon-contour');
  if (!contour) return;

  const lights = ['#pro-neon-light-a', '#pro-neon-light-b'].map(id => svg.querySelector(id));
  const motion = matchMedia('not all') /* full motion for everyone, owner's decision 07/10/26 */;
  let perimeter = 0;
  let phase = .08;
  let visible = false;
  let prepared = false;
  let frame = 0;
  let previousTime = null;
  let measuredWidth = 0;
  let measuredHeight = 0;

  function draw() {
    if (!perimeter) return;
    lights.forEach((light, index) => {
      const distance = ((phase + index * .5) % 1) * perimeter;
      const point = contour.getPointAtLength(distance);
      const before = contour.getPointAtLength((distance - 1 + perimeter) % perimeter);
      const after = contour.getPointAtLength((distance + 1) % perimeter);
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      light.setAttribute('cx', point.x.toFixed(3));
      light.setAttribute('cy', point.y.toFixed(3));
      // Keep the bright tip on the contour, with a longer, fading wake behind it.
      light.setAttribute('fx', (point.x + 18).toFixed(3));
      light.setAttribute('fy', point.y.toFixed(3));
      light.setAttribute('gradientTransform', `translate(${point.x} ${point.y}) rotate(${angle}) scale(2.6 1) translate(${-point.x - 18} ${-point.y})`);
    });
  }

  function tick(time) {
    frame = 0;
    if (previousTime !== null) phase = (phase + (time - previousTime) / 5000) % 1;
    previousTime = time;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    const playing = visible && !document.hidden && !motion.matches && perimeter > 0;
    if (playing && !frame) {
      previousTime = null;
      frame = requestAnimationFrame(tick);
    } else if (!playing) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = null;
      draw();
    }
  }

  function measure() {
    if (!prepared) return;
    const { width, height } = button.getBoundingClientRect();
    if (width <= 2 || height <= 2 || (width === measuredWidth && height === measuredHeight)) return;
    measuredWidth = width;
    measuredHeight = height;
    // Match the SVG to its actual CSS size; never stretch a smaller rasterized glow.
    const inset = 1;
    const radius = (height - inset * 2) / 2;
    const left = inset + radius;
    const right = width - inset - radius;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    contour.setAttribute('d', `M${left} ${inset}H${right}A${radius} ${radius} 0 0 1 ${right} ${height - inset}H${left}A${radius} ${radius} 0 0 1 ${left} ${inset}Z`);
    perimeter = contour.getTotalLength();
    draw();
    button.setAttribute('data-neon-ready', '');
    updatePlayback();
  }

  new ResizeObserver(measure).observe(button);
  const preparationObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    prepared = true; measure(); preparationObserver.disconnect();
  }, { rootMargin: '100% 0px' });
  preparationObserver.observe(button);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }).observe(button);
  motion.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  measure();
})();
