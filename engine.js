/* Dream engine: pure roll logic over the grammar in data/grammar.json.
   No DOM access, so it runs in the browser and in Node (test.js). */
(function (root) {
  "use strict";

  function create(grammar, opts) {
    opts = opts || {};
    var rand = opts.random || Math.random;
    var C = grammar.characters, P = grammar.places, Q = grammar.quests;
    var lastChar = -1, lastPlace = -1;

    function randInt(n) { return Math.floor(rand() * n); }

    // Uniform pick that never repeats the previous index twice in a row.
    function pickAvoiding(n, avoid) {
      var i = randInt(n);
      if (n > 1 && i === avoid) i = (i + 1 + randInt(n - 1)) % n;
      return i;
    }

    function kindredPlaces(c) {
      var out = [];
      for (var i = 0; i < P.length; i++) if (c.realms.indexOf(P[i].realm) !== -1) out.push(i);
      return out;
    }

    function build(ci, pi, qi) {
      var c = C[ci], p = P[pi];
      return {
        ci: ci, pi: pi, qi: qi,
        character: c, place: p, quest: Q[qi],
        wild: c.realms.indexOf(p.realm) === -1,
        text: render(c, p, Q[qi])
      };
    }

    function render(c, p, q) {
      return grammar.template
        .replace("{character}", c.name)
        .replace("{place}", p.text)
        .replace("{quest}", q);
    }

    // kindred: bool. bias: 0..1 chance of forcing a realm-matched place.
    function roll(kindred, bias) {
      var ci = pickAvoiding(C.length, lastChar);
      var pi;
      if (kindred && rand() < bias) {
        var kin = kindredPlaces(C[ci]);
        pi = kin.length ? kin[randInt(kin.length)] : pickAvoiding(P.length, lastPlace);
      } else {
        pi = pickAvoiding(P.length, lastPlace);
      }
      lastChar = ci; lastPlace = pi;
      return build(ci, pi, randInt(Q.length));
    }

    // Share code: "DRM-005.0.12" (character id . place index . quest index).
    function encode(d) { return d.character.id + "." + d.pi + "." + d.qi; }
    function decode(code) {
      var m = /^(DRM-\d{3})\.(\d+)\.(\d+)$/.exec(String(code || ""));
      if (!m) return null;
      var ci = -1;
      for (var i = 0; i < C.length; i++) if (C[i].id === m[1]) ci = i;
      var pi = +m[2], qi = +m[3];
      if (ci < 0 || pi >= P.length || qi >= Q.length) return null;
      lastChar = ci; lastPlace = pi;
      return build(ci, pi, qi);
    }

    return {
      roll: roll, build: build, encode: encode, decode: decode,
      total: C.length * P.length * Q.length
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DreamEngine = api;
})(this);
