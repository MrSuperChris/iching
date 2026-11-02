// oracle.js — optional LLM interpretation that actually responds to the question.
//
// WHY THIS EXISTS: the built-in questionSummary() in app.js is a fixed template —
// it echoes the question and pastes the hexagram's generic gloss, so the answer is
// the same whatever you ask. When a Groq API key is present, this module asks a
// hosted open model to read the question together with the cast and reply in the
// app's spare, classical register. It is strictly additive: if there is no key, no
// network, a rate-limit, or any error, app.js keeps the template answer and the
// app never shows an error instead of a reading.
//
// PRIVACY / PROVIDER (Chris's decision, 2026-09-30): the question and the cast
// hexagram may leave the device, but ONLY to Groq's free tier — not to a paid API,
// and no server of our own. This matches Babel (voice-tasker), which calls
// api.groq.com directly from the client with a user-supplied key. Groq's DPA
// (effective 2025-10-15) restricts processing of customer data to service delivery
// and does not train on inputs; retention is off by default. Verified on Groq's own
// pages 2026-10-02.
//
// Depends on nothing; app.js calls consultOracle() and resolveGroqKeySource().

// Groq-hosted open chat model. Was llama-3.3-70b-versatile until Groq RETIRED that
// model on 2026-08-16 (console.groq.com/docs/deprecations, checked 2026-11-02); after
// the shutdown a request for that id returns HTTP 404, which surfaced to Chris as
// "the oracle couldn't be reached (Groq error 404)" and made the app fall back to the
// template on every reading. openai/gpt-oss-120b is Groq's OWN recommended replacement
// for the retired model, is a current production (not preview) model on the free tier,
// and is well suited to a 2-4 sentence interpretive answer. Provider and privacy are
// unchanged (Groq free tier, client-side, no server) — only the model id moved,
// because Groq moved it.
//
// gpt-oss-120b is a REASONING model: reasoning tokens count toward the completion
// budget, so a small max_tokens could be spent on reasoning and return empty content
// (which would silently fall back forever — the very failure we are fixing). Per Groq's
// reasoning docs (console.groq.com/docs/reasoning, 2026-11-02) we therefore set
// reasoning_effort "low", include_reasoning false, and a 1024-token budget, and read
// the clean final answer from message.content as before.
const ORACLE_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// KEY SHARING (Chris's decision): the four PWAs on mrsuperchris.github.io share one
// localStorage origin, so a key pasted into Babel is readable here. Precedence:
//   1. I Ching's own key (iching-settings.groqKey), if the user set one here;
//   2. otherwise Babel's key (voice-tasker-settings.openaiKey) — "one paste for both".
// This gives zero-friction use when Babel is already set up, while still letting
// I Ching hold its own key if the user prefers to keep them separate.
function resolveGroqKeySource() {
  try {
    const own = JSON.parse(localStorage.getItem("iching-settings") || "{}");
    if (own && typeof own.groqKey === "string" && own.groqKey.trim()) {
      return { key: own.groqKey.trim(), source: "own" };
    }
  } catch (_) { /* fall through to Babel */ }
  try {
    const babel = JSON.parse(localStorage.getItem("voice-tasker-settings") || "{}");
    if (babel && typeof babel.openaiKey === "string" && babel.openaiKey.trim()) {
      return { key: babel.openaiKey.trim(), source: "babel" };
    }
  } catch (_) { /* no key anywhere */ }
  return { key: "", source: "" };
}

function resolveGroqKey() {
  return resolveGroqKeySource().key;
}

// Failures carry a `kind` so app.js can say in plain words why the oracle didn't
// answer: "nokey" | "auth" | "rate" | "network" | "http" | "empty" | "abort".
function oracleError(kind, message, status) {
  const err = new Error(message);
  err.kind = kind;
  if (status) err.status = status;
  return err;
}

const ORACLE_SYSTEM = [
  "You are an I Ching oracle speaking in a spare, classical, ink-and-paper register.",
  "A seeker has posed a question and cast a hexagram. Answer THEIR question directly,",
  "grounded in the meaning of the hexagram they cast and in the movement of any",
  "changing lines toward the second hexagram. Name what the reading counsels about",
  "the actual matter they asked about — do not merely restate the hexagram.",
  "Write 2 to 4 sentences, plain prose, no lists, no headings, no emoji, no markdown,",
  "no chirpy assistant voice, no preamble like 'Certainly'. Do not invent hexagram",
  "names or line texts beyond what you are given. If the question is blank or nonsense,",
  "speak briefly to the hexagram as it stands.",
].join(" ");

// Build the user-turn content from a reading object (as produced by readingFromValues).
function buildOraclePrompt(reading) {
  const p = reading.primary;
  const lines = [];
  lines.push(`Question: ${reading.question || "(none given)"}`);
  lines.push("");
  lines.push(`Hexagram cast: ${p.number}. ${p.name} (${p.pinyin})`);
  lines.push(`Judgment: ${p.judgment}`);
  lines.push(`Image: ${p.image}`);
  lines.push(`Meaning: ${p.gloss}`);
  if (reading.transformed && reading.changingIndices && reading.changingIndices.length) {
    const ord = ["first (bottom)", "second", "third", "fourth", "fifth", "sixth (top)"];
    const which = reading.changingIndices.map((i) => ord[i]).join(", ");
    const t = reading.transformed;
    lines.push("");
    lines.push(`Changing line(s): the ${which} line(s) are moving, so the situation`);
    lines.push(`transforms toward ${t.number}. ${t.name} (${t.pinyin}).`);
    lines.push(`Where it heads — meaning: ${t.gloss}`);
  } else {
    lines.push("");
    lines.push("No changing lines: the situation is stable; read the hexagram as it stands.");
  }
  return lines.join("\n");
}

// Ask the oracle. Returns the interpretation string on success.
// THROWS on any failure (no key, network, non-2xx, empty) so the caller can fall
// back to the template — this function never returns a half-answer or an error string.
// The thrown error's `kind` says which failure it was (see oracleError above).
async function consultOracle(reading, apiKey, { signal } = {}) {
  const key = (apiKey || "").trim();
  if (!key) throw oracleError("nokey", "no Groq key");

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ORACLE_MODEL,
        temperature: 0.7,
        // gpt-oss reasoning tokens share this budget; 1024 leaves room for a short
        // "low"-effort reasoning pass plus the 2-4 sentence answer (see model note above).
        max_completion_tokens: 1024,
        reasoning_effort: "low",
        include_reasoning: false,
        messages: [
          { role: "system", content: ORACLE_SYSTEM },
          { role: "user", content: buildOraclePrompt(reading) },
        ],
      }),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw oracleError("abort", "aborted");
    throw oracleError("network", "network error");
  }

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error?.message || ""; } catch (_) {}
    const kind = res.status === 429 ? "rate"
      : (res.status === 401 || res.status === 403) ? "auth" : "http";
    throw oracleError(kind, `Groq ${res.status}${detail ? ": " + detail : ""}`, res.status);
  }
  let data;
  try { data = await res.json(); } catch (_) { data = null; }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw oracleError("empty", "Groq returned no text");
  return text;
}

// Expose for app.js (plain scripts, shared globals — same pattern as the rest of the app).
window.IChingOracle = { consultOracle, resolveGroqKey, resolveGroqKeySource, buildOraclePrompt, ORACLE_MODEL };
