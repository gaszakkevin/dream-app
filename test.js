// Grammar and engine checks: `node test.js`
const assert = require("assert");
const G = require("./data/grammar.json");
const { create } = require("./engine.js");

// Grammar shape
assert.strictEqual(G.characters.length, 20, "20 characters");
assert.strictEqual(G.places.length, 24, "24 places");
assert.strictEqual(G.quests.length, 60, "60 quests");
const realms = new Set(G.places.map(p => p.realm));
for (const c of G.characters) {
  assert.strictEqual(c.palette.length, 4, c.id + " has 4 palette colours");
  assert.ok(/^https:\/\/(youtu\.be\/|www\.youtube\.com\/)/.test(c.watch || ""), c.id + " has a YouTube watch link");
  for (const r of c.realms) assert.ok(realms.has(r), c.id + " realm " + r + " has at least one place");
}

const e = create(G);
assert.strictEqual(e.total, 28800);

// Opening dream matches the demo
assert.strictEqual(e.build(4, 0, 0).text,
  "Tonight, dream about Pip the Lantern Bunny, lost in a library made of rain, looking for a song someone forgot.");

// Share codes round-trip
for (let i = 0; i < 200; i++) {
  const d = e.roll(false, 0);
  assert.strictEqual(e.decode(e.encode(d)).text, d.text);
}
assert.strictEqual(e.decode("junk"), null);
assert.strictEqual(e.decode("DRM-999.0.0"), null);
assert.strictEqual(e.decode("DRM-001.99.0"), null);

// Bias behaves: kindred share should track bias plus the chance a random place is kindred anyway
function kindredRate(kindred, bias, n = 40000) {
  const eng = create(G);
  let k = 0;
  for (let i = 0; i < n; i++) if (!eng.roll(kindred, bias).wild) k++;
  return k / n;
}
const base = kindredRate(false, 0);
const r100 = kindredRate(true, 1);
const r60 = kindredRate(true, 0.6);
const r80 = kindredRate(true, 0.8);
assert.strictEqual(r100, 1, "bias 1.0 is always kindred");
assert.ok(Math.abs(r60 - (0.6 + 0.4 * base)) < 0.02, "bias 0.6 rate " + r60);
assert.ok(Math.abs(r80 - (0.8 + 0.2 * base)) < 0.02, "bias 0.8 rate " + r80);

// No immediate repeats of the character
const eng = create(G);
let last = null;
for (let i = 0; i < 2000; i++) { const d = eng.roll(true, 0.8); assert.notStrictEqual(d.ci, last); last = d.ci; }

console.log("All checks passed.");
console.log("Kindred (realm-matched) share of dreams:");
console.log("  Anything goes: " + (base * 100).toFixed(1) + "%");
console.log("  Kindred @0.6:  " + (r60 * 100).toFixed(1) + "%");
console.log("  Kindred @0.8:  " + (r80 * 100).toFixed(1) + "%");
