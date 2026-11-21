// HOME scrubber: the first image (01.webp) of each project in portfolio-data.js, in that order.
// Ported from scrubber_01_newsite (scrubber.js + intro in index.html) with these changes:
// - Pointer Events only: one tap / click = exactly one step (pointerup), drag never adds a step,
//   pointercancel / lost capture always clears the drag state.
// - Arrow keys only while the scrubber itself has focus.
// - The intro auto-play stops for good on the first user input and never resets the user's frame.
(() => {
  const box = document.getElementById('scrubber');
  const img = document.getElementById('scrubber-img');
  if (!box || !img) return;

  const frames = (window.PORTFOLIO_PROJECTS || []).map(p => {
    const images = (p.media || []).filter(m => m.type === 'image' && m.full);
    const m = images.find(m => /\/01\.webp$/.test(m.full)) || images[0];
    return m && { src: m.full, w: m.dataW, h: m.dataH, title: p.title };
  }).filter(Boolean);
  if (!frames.length) return;

  const PX_PER_STEP = { mouse: 25, pen: 25, touch: 12 }; // reference GAIN 0.04 / 0.08
  const TAP_SLOP = 6;                                     // px; beyond this it is a drag
  let current = -1;

  function show(i) {
    i = ((i % frames.length) + frames.length) % frames.length;
    if (i === current) return;
    current = i;
    const f = frames[i];
    if (f.w && f.h) { img.width = f.w; img.height = f.h; }
    img.src = f.src;
    img.alt = f.title;
    box.setAttribute('aria-label', `Selected work, ${i + 1} of ${frames.length}: ${f.title}. Use the left and right arrow keys to change.`);
  }
  const step = d => { stopIntro(); show(current + d); };

  // ---- Preload + decode all frames so swaps are instant ----
  const ready = Promise.all(frames.map(f => new Promise(resolve => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(resolve);
    im.onerror = resolve;
    im.src = f.src;
  })));

  // ---- Pointer: tap = prev / next by image half, drag = scrub, mouse hover = scrub ----
  let drag = null;  // { id, type, startX, lastX, acc, moved }
  let hoverX = null, hoverAcc = 0;

  img.addEventListener('dragstart', e => e.preventDefault());

  img.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    stopIntro();
    drag = { id: e.pointerId, type: e.pointerType, startX: e.clientX, lastX: e.clientX, acc: 0, moved: false };
    try { img.setPointerCapture(e.pointerId); } catch (_) {}
    if (e.pointerType !== 'mouse') e.preventDefault();
  });

  img.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      if (Math.abs(e.clientX - drag.startX) > TAP_SLOP) drag.moved = true;
      drag.acc += e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      const per = PX_PER_STEP[drag.type] || PX_PER_STEP.mouse;
      while (Math.abs(drag.acc) >= per) { const d = Math.sign(drag.acc); drag.acc -= d * per; show(current + d); }
      return;
    }
    if (e.pointerType !== 'mouse') return;   // hover scrubbing is mouse-only
    if (hoverX !== null) {
      hoverAcc += e.clientX - hoverX;
      if (Math.abs(hoverAcc) >= PX_PER_STEP.mouse) stopIntro();
      while (Math.abs(hoverAcc) >= PX_PER_STEP.mouse) { const d = Math.sign(hoverAcc); hoverAcc -= d * PX_PER_STEP.mouse; show(current + d); }
    }
    hoverX = e.clientX;
  });
  img.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hoverX = null; hoverAcc = 0; } });

  img.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = !drag.moved;
    drag = null;
    hoverX = e.clientX; hoverAcc = 0;
    if (tap) {
      const r = img.getBoundingClientRect();
      step(e.clientX >= r.left + r.width / 2 ? 1 : -1);
    }
  });
  const cancel = e => { if (drag && e.pointerId === drag.id) drag = null; };
  img.addEventListener('pointercancel', cancel);
  img.addEventListener('lostpointercapture', cancel);

  // ---- Keyboard: only while the scrubber has focus ----
  box.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // ---- Intro: once through all frames at 8 fps, then back to the first one ----
  const INTRO_STEP = 1000 / 8;
  let introTimer = 0, introDone = false;
  function stopIntro() { introDone = true; clearTimeout(introTimer); introTimer = 0; }
  function introTick(i) {
    if (introDone) return;
    if (document.hidden) { introTimer = setTimeout(() => introTick(i), INTRO_STEP); return; } // pause, resume later
    if (i >= frames.length) { stopIntro(); show(0); return; }
    show(i);
    introTimer = setTimeout(() => introTick(i + 1), INTRO_STEP);
  }

  show(0);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || frames.length < 2) introDone = true;
  ready.then(() => { if (!introDone) introTick(1); });
})();
