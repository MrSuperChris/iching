// Casting engine: yarrow-stalk probabilities, changing lines, transformed hexagram.
// Depends on globals from data.js (hexagramFromLines), loaded before this script.

// Yarrow-stalk method line probabilities (out of 16):
//   6  old yin   (changing, --x--)  : 1/16
//   8  young yin (stable,   -- --)  : 7/16
//   7  young yang(stable,   ----- ) : 5/16
//   9  old yang  (changing, --o--)  : 3/16
// (Note: the three-coin method would instead be 2/16, 6/16, 6/16, 2/16.)
function castLineValue(rng) {
  const r = Math.floor(rng() * 16); // 0..15
  if (r < 1) return 6;       // 1/16
  if (r < 1 + 7) return 8;   // 7/16
  if (r < 1 + 7 + 5) return 7; // 5/16
  return 9;                  // 3/16
}

// A line value -> descriptor.
function lineInfo(value) {
  return {
    value,
    yang: value === 7 || value === 9,    // solid?
    changing: value === 6 || value === 9, // moving line?
  };
}

// Cast a single line (returns its value 6/7/8/9).
function castLine(rng = Math.random) {
  return castLineValue(rng);
}

// Build a full reading from 6 line VALUES (bottom -> top).
function readingFromValues(values, question = "") {
  if (values.length !== 6) throw new Error("Need exactly 6 line values");

  const primaryLines = values.map((v) => (v === 7 || v === 9 ? 1 : 0)); // bottom->top
  const changing = values.map((v) => v === 6 || v === 9);

  const primary = hexagramFromLines(primaryLines);

  let transformed = null;
  const changingIndices = changing
    .map((c, i) => (c ? i : -1))
    .filter((i) => i >= 0);

  if (changingIndices.length > 0) {
    const transformedLines = primaryLines.map((l, i) => (changing[i] ? (l === 1 ? 0 : 1) : l));
    transformed = hexagramFromLines(transformedLines);
  }

  return {
    question,
    values,                 // raw 6/7/8/9 per line, bottom->top
    lines: primaryLines,    // 1/0 bottom->top
    changing,               // bool per line, bottom->top
    changingIndices,        // 0-based, bottom->top
    primary,
    transformed,
  };
}

// Cast a fresh full reading (all six lines).
function castReading(question = "", rng = Math.random) {
  const values = Array.from({ length: 6 }, () => castLine(rng));
  return readingFromValues(values, question);
}
