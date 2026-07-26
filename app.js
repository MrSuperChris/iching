// Depends on globals from data.js and iching.js, loaded before this script:
//   TRIGRAMS, castLine, readingFromValues

/* ---------------- state ---------------- */
const state = {
  mode: "ritual",      // "ritual" | "quick"
  values: [],          // line values cast so far (bottom -> top)
  slots: [],           // the six line-slot elements (ghost or cast)
  casting: false,      // animation in flight
  done: false,
};

const $ = (id) => document.getElementById(id);

const el = {
  screenCast: $("screen-cast"),
  screenReading: $("screen-reading"),
  question: $("question"),
  modeRitual: $("mode-ritual"),
  modeQuick: $("mode-quick"),
  coins: $("coins"),
  buildLines: $("build-lines"),
  castHint: $("cast-hint"),
  dots: $("progress-dots"),
  manualCast: $("manual-cast"),
  enableMotion: $("enable-motion"),
  motionNote: $("motion-note"),
  back: $("back-btn"),
  readingQuestion: $("reading-question"),
  primaryLines: $("primary-lines"),
  primaryCaption: $("primary-caption"),
  transformedFigure: $("transformed-figure"),
  transformedLines: $("transformed-lines"),
  transformedCaption: $("transformed-caption"),
  transformArrow: $("transform-arrow"),
  changingNote: $("changing-note"),
  questionSummary: $("question-summary"),
  readingBody: $("reading-body"),
};

/* ---------------- helpers ---------------- */
function vibrate(ms) {
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} }
}

// Build a single hexagram-line element from a value (6/7/8/9) or a 1/0 with optional changing flag.
function lineEl({ value = null, yang = null, changing = false, drawing = false }) {
  const div = document.createElement("div");
  const isYang = value != null ? (value === 7 || value === 9) : yang;
  const isChanging = value != null ? (value === 6 || value === 9) : changing;
  div.className = "hex-line " + (isYang ? "yang" : "yin");
  if (isChanging) {
    div.classList.add("changing");
    div.classList.add(isYang ? "mark-o" : "mark-x");
  }
  if (drawing) div.classList.add("drawing");
  if (isYang) {
    div.innerHTML = '<span class="bar"></span>';
  } else {
    div.innerHTML = '<span class="bar"></span><span class="bar"></span>';
  }
  return div;
}

// A faint placeholder slot so the empty hexagram frame is always visible.
function ghostSlotEl() {
  const div = document.createElement("div");
  div.className = "hex-line ghost yang";
  div.innerHTML = '<span class="bar"></span>';
  return div;
}

// Lay down six ghost slots (bottom -> top) and remember them for replacement.
function renderGhostSlots() {
  el.buildLines.innerHTML = "";
  state.slots = [];
  for (let i = 0; i < 6; i++) {
    const g = ghostSlotEl();
    el.buildLines.appendChild(g);
    state.slots.push(g);
  }
}

// Replace the i-th slot (0 = bottom) with a real cast line.
function placeLine(i, value) {
  const real = lineEl({ value, drawing: true });
  if (state.slots[i]) {
    el.buildLines.replaceChild(real, state.slots[i]);
  } else {
    el.buildLines.appendChild(real);
  }
  state.slots[i] = real;
}

function renderDots() {
  el.dots.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const d = document.createElement("span");
    d.className = "dot";
    if (i < state.values.length) {
      d.classList.add("filled");
      const v = state.values[i];
      if (v === 6 || v === 9) d.classList.add("changing");
    }
    el.dots.appendChild(d);
  }
}

function setHint(text, pulse = true) {
  el.castHint.textContent = text;
  el.castHint.classList.toggle("pulse", pulse);
}

/* ---------------- casting flow ---------------- */
function resetCast() {
  state.values = [];
  state.done = false;
  state.casting = false;
  renderGhostSlots();
  renderDots();
  if (state.mode === "ritual") {
    setHint("Shake your phone to cast the first line");
  } else {
    setHint("Shake your phone once to cast");
  }
}

async function flourishCoins() {
  el.coins.classList.add("shaking");
  vibrate(35);
  await new Promise((r) => setTimeout(r, 620));
  el.coins.classList.remove("shaking");
}

// Ritual mode: each trigger casts exactly one line.
async function castOneLine() {
  if (state.casting || state.done || state.mode !== "ritual") return;
  state.casting = true;
  el.manualCast.classList.add("hidden");

  await flourishCoins();

  const value = castLine();
  state.values.push(value);
  placeLine(state.values.length - 1, value);
  renderDots();
  vibrate([0, 18]);

  const n = state.values.length;
  if (n < 6) {
    setHint(`Line ${n} cast — shake again for line ${n + 1}`);
    el.manualCast.classList.remove("hidden");
    state.casting = false;
  } else {
    setHint("The hexagram is complete…", false);
    state.done = true;
    await new Promise((r) => setTimeout(r, 800));
    showReading();
    state.casting = false;
  }
}

// Quick mode: one trigger casts all six lines in a quick cascade.
async function castWholeHexagram() {
  if (state.casting || state.done || state.mode !== "quick") return;
  state.casting = true;
  el.manualCast.classList.add("hidden");
  state.values = [];
  renderGhostSlots();

  await flourishCoins();

  for (let i = 0; i < 6; i++) {
    const value = castLine();
    state.values.push(value);
    placeLine(i, value);
    renderDots();
    vibrate([0, 12]);
    await new Promise((r) => setTimeout(r, 160));
  }
  setHint("The hexagram is complete…", false);
  state.done = true;
  await new Promise((r) => setTimeout(r, 750));
  showReading();
  state.casting = false;
}

function triggerCast() {
  if (state.mode === "ritual") castOneLine();
  else castWholeHexagram();
}

/* ---------------- reading render ---------------- */
function trigramLabel(h) {
  const lo = TRIGRAMS[h.lower], up = TRIGRAMS[h.upper];
  return `${up.char} ${up.name} over ${lo.char} ${lo.name}`;
}

function captionHTML(h) {
  return `
    <div class="glyph">${h.char}</div>
    <div class="num">No. ${h.number}</div>
    <div class="nm">${h.name}</div>
    <div class="py">${h.pinyin}</div>`;
}

function renderHexLines(container, lines, changing) {
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    container.appendChild(lineEl({ yang: lines[i] === 1, changing: changing ? changing[i] : false }));
  }
}

const ORDINALS = ["first (bottom)", "second", "third", "fourth", "fifth", "sixth (top)"];

// Escape user-supplied text before it goes anywhere via innerHTML.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// First sentence of a gloss, trimmed (glosses are static, trusted data).
function firstSentence(text) {
  const m = String(text).match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : String(text)).trim();
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Build a short interpretive summary tying the cast to the user's real question.
// Template/heuristic only — no LLM, no network. Returns "" when there is no real
// question (blank, or the placeholder left untouched), so blank casts are unchanged.
function questionSummary(reading) {
  const q = (reading.question || "").trim();
  if (!q) return "";
  const placeholder = (el.question.getAttribute("placeholder") || "").trim();
  if (q === placeholder) return "";

  const qHtml = escapeHtml(q);
  const primaryCore = firstSentence(reading.primary.gloss);
  const parts = [];
  parts.push(
    `On your question — <span class="qs-q">${qHtml}</span> — <strong>${reading.primary.name}</strong> answers: ${primaryCore}`
  );

  if (reading.transformed && reading.changingIndices.length > 0) {
    const n = reading.changingIndices.length;
    const which = reading.changingIndices.map((i) => ORDINALS[i]).join(", ");
    const transformedCore = firstSentence(reading.transformed.gloss);
    parts.push(
      `The ${which} line${n > 1 ? "s are" : " is"} changing, so it moves toward ` +
      `<strong>${reading.transformed.name}</strong> — ${lowerFirst(transformedCore)} ` +
      `Read your question as passing from the first hexagram toward the second.`
    );
  } else {
    parts.push(
      "With no changing lines, the answer is settled — meet your question as it stands rather than waiting for it to shift."
    );
  }
  return parts.join(" ");
}

function showReading() {
  const reading = readingFromValues(state.values, el.question.value.trim());
  const { primary, transformed, changingIndices } = reading;

  el.readingQuestion.textContent = reading.question || "";

  renderHexLines(el.primaryLines, reading.lines, reading.changing);
  el.primaryCaption.innerHTML = captionHTML(primary);

  if (transformed) {
    el.transformArrow.classList.remove("hidden");
    el.transformedFigure.hidden = false;
    renderHexLines(el.transformedLines, transformed.lines, null);
    el.transformedCaption.innerHTML = captionHTML(transformed);
  } else {
    el.transformArrow.classList.add("hidden");
    el.transformedFigure.hidden = true;
  }

  // changing-line note
  if (changingIndices.length === 0) {
    el.changingNote.textContent =
      "No changing lines — the situation is stable. Read the hexagram as it stands.";
  } else {
    const which = changingIndices.map((i) => ORDINALS[i]).join(", ");
    el.changingNote.innerHTML =
      `Changing line${changingIndices.length > 1 ? "s" : ""} (marked in cinnabar): the ${which} line${changingIndices.length > 1 ? "s" : ""}. ` +
      `These transform the present situation into <strong>${transformed.name}</strong> — read the first hexagram as where you are, the second as where it is heading.`;
  }

  // question-tied summary (only when a real question was posed)
  const summary = questionSummary(reading);
  if (summary) {
    el.questionSummary.innerHTML = summary;
    el.questionSummary.hidden = false;
  } else {
    el.questionSummary.innerHTML = "";
    el.questionSummary.hidden = true;
  }

  // body: gloss + classical for primary (+ transformed if present)
  let html = "";
  html += section(primary, true);
  if (transformed) {
    html += `<div class="divider-seal"><span>變</span></div>`;
    html += section(transformed, false, "Where it is heading");
  }
  el.readingBody.innerHTML = html;

  el.screenCast.classList.remove("active");
  el.screenReading.classList.add("active");
  window.scrollTo(0, 0);
}

function section(h, isPrimary, headingOverride) {
  const heading = headingOverride || (isPrimary ? "The present" : "");
  return `
    <div class="reading-section">
      ${heading ? `<h3>${heading} · ${h.name}</h3>` : `<h3>${h.name}</h3>`}
      <p class="gloss">${h.gloss}</p>
    </div>
    <div class="reading-section">
      <h3>Classical text · Legge</h3>
      <p class="classic">
        <span class="label">The Judgment</span>${h.judgment}
        <span class="label">The Image</span>${h.image}
      </p>
      <p class="classic" style="margin-top:14px;color:var(--ink-faint);font-size:13px;">${trigramLabel(h)}</p>
    </div>`;
}

/* ---------------- mode switching ---------------- */
function setMode(mode) {
  if (state.casting) return;
  state.mode = mode;
  const ritual = mode === "ritual";
  el.modeRitual.classList.toggle("active", ritual);
  el.modeQuick.classList.toggle("active", !ritual);
  el.modeRitual.setAttribute("aria-selected", String(ritual));
  el.modeQuick.setAttribute("aria-selected", String(!ritual));
  resetCast();
}

/* ---------------- shake detection ---------------- */
let lastMag = 0;
let lastShake = 0;
const SHAKE_THRESHOLD = 16;   // m/s^2 of jerk
const SHAKE_COOLDOWN = 900;   // ms between accepted shakes

function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  const jerk = Math.abs(mag - lastMag);
  lastMag = mag;
  const now = Date.now();
  if (jerk > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN) {
    lastShake = now;
    if (el.screenCast.classList.contains("active")) triggerCast();
  }
}

function startMotion() {
  window.addEventListener("devicemotion", onMotion, { passive: true });
}

function setupMotion() {
  const hasMotion = typeof window.DeviceMotionEvent !== "undefined";
  if (!hasMotion) {
    el.motionNote.textContent = "Shake not available on this device — tap to cast instead.";
    return;
  }
  // iOS 13+ requires explicit permission via a user gesture.
  const needsPermission = typeof DeviceMotionEvent.requestPermission === "function";
  if (needsPermission) {
    el.enableMotion.classList.remove("hidden");
    el.motionNote.textContent = "Tap to allow motion access, then shake to cast.";
    el.enableMotion.addEventListener("click", async () => {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res === "granted") {
          startMotion();
          el.enableMotion.classList.add("hidden");
          el.motionNote.textContent = "Shake away.";
        } else {
          el.motionNote.textContent = "Motion denied — tap to cast instead.";
        }
      } catch (_) {
        el.motionNote.textContent = "Motion unavailable — tap to cast instead.";
      }
    });
  } else {
    startMotion();
    el.motionNote.textContent = "Shake your phone to cast. (On desktop, tap or press space.)";
  }
}

/* ---------------- wiring ---------------- */
el.modeRitual.addEventListener("click", () => setMode("ritual"));
el.modeQuick.addEventListener("click", () => setMode("quick"));
el.manualCast.addEventListener("click", triggerCast);
el.back.addEventListener("click", () => {
  el.screenReading.classList.remove("active");
  el.screenCast.classList.add("active");
  resetCast();
  window.scrollTo(0, 0);
});

// desktop convenience: space / enter casts
window.addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "Enter") && el.screenCast.classList.contains("active")
      && document.activeElement !== el.question) {
    e.preventDefault();
    triggerCast();
  }
});

resetCast();
setupMotion();

/* ---------------- service worker ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
