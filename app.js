/* UI layer: loads the grammar, drives the engine, paints the page. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var line = $("line"), ask = $("ask"), whoRow = $("whoRow");
  var whoId = $("whoId"), whoTy = $("whoTy"), wildTag = $("wildTag");
  var moon = $("moon"), keepBtn = $("keep"), shareBtn = $("share"), watchBtn = $("watch"), countEl = $("count");
  var biasInput = $("bias"), biasVal = $("biasVal"), tune = $("tune");

  var SHELF_KEY = "wsida_shelf_v1", PREF_KEY = "wsida_prefs_v1";

  // ---- storage (per-device convenience; must survive being unavailable) ---
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  fetch("data/grammar.json")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function (e) {
      line.textContent = "The dream book would not open. Check your connection and try again.";
      console.error("grammar load failed", e);
    });

  function start(G) {
    var engine = DreamEngine.create(G);
    var params = new URLSearchParams(location.search);
    var prefs = load(PREF_KEY, {});

    // Bias precedence: ?bias= link override, then this device's slider, then grammar default.
    var bias = clamp01(parseFloat(params.get("bias")));
    if (isNaN(bias)) bias = clamp01(prefs.bias);
    if (isNaN(bias)) bias = clamp01(G.bias.default);
    if (isNaN(bias)) bias = 0.6;
    var kindred = prefs.kindred !== false;

    var shelf = load(SHELF_KEY, []);
    var current = null, seen = 0;

    function clamp01(x) { x = +x; return isNaN(x) ? NaN : Math.max(0, Math.min(1, x)); }

    function savePrefs() { save(PREF_KEY, { bias: bias, kindred: kindred }); }

    function paintBias() {
      var pct = Math.round(bias * 100);
      biasInput.value = pct;
      biasVal.textContent = pct + "%";
      tune.classList.toggle("off", !kindred);
      biasInput.disabled = !kindred;
    }

    function paintMode() {
      $("mKin").setAttribute("aria-pressed", String(kindred));
      $("mAny").setAttribute("aria-pressed", String(!kindred));
      paintBias();
    }

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
      });
    }

    function paint(d, animate) {
      current = d;
      var p = d.character.palette;
      root.style.setProperty("--c1", p[0]);
      root.style.setProperty("--c2", p[1]);
      root.style.setProperty("--c3", p[2]);
      root.style.setProperty("--c4", p[3]);
      setTint(p[0]);

      line.innerHTML =
        '<span class="seg">Tonight, dream about <em>' + esc(d.character.name) + '</em>,</span> ' +
        '<span class="seg">' + esc(d.place.text) + ',</span> ' +
        '<span class="seg">' + esc(d.quest) + '.</span>';

      whoId.textContent = d.character.id;
      whoTy.textContent = d.character.type + " · " + d.character.realms.join(" / ");
      wildTag.hidden = !d.wild;
      watchBtn.textContent = "Watch " + d.character.name.split(" ")[0];
      watchBtn.hidden = !d.character.watch;

      seen++;
      countEl.textContent = seen.toLocaleString() + " of " + engine.total.toLocaleString() + " dreams";

      var kept = shelf.some(function (s) { return s.code === engine.encode(d); });
      keepBtn.textContent = kept ? "Kept ✓" : "Keep this dream";
      keepBtn.classList.toggle("kept", kept);

      var segs = line.querySelectorAll(".seg");
      whoRow.classList.remove("on");
      if (!animate) {
        for (var k = 0; k < segs.length; k++) segs[k].classList.add("on");
        whoRow.classList.add("on");
        return;
      }
      Array.prototype.forEach.call(segs, function (s, i) {
        setTimeout(function () { s.classList.add("on"); }, 120 + i * 190);
      });
      setTimeout(function () { whoRow.classList.add("on"); }, 120 + segs.length * 190);
    }

    function go() {
      moon.classList.remove("rolling");
      void moon.offsetWidth;
      moon.classList.add("rolling");
      ask.textContent = G.leads[Math.floor(Math.random() * G.leads.length)];
      var segs = line.querySelectorAll(".seg");
      for (var i = 0; i < segs.length; i++) segs[i].classList.remove("on");
      whoRow.classList.remove("on");
      setTimeout(function () {
        paint(engine.roll(kindred, bias), true);
        // Clear a shared-dream link once the viewer rolls their own.
        if (location.search.indexOf("d=") !== -1) {
          params.delete("d");
          var q = params.toString();
          history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
        }
      }, 260);
    }

    // ---- share ---------------------------------------------------------
    var toastTimer;
    function toast(msg) {
      var t = $("toast");
      t.textContent = msg;
      t.classList.add("on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.remove("on"); }, 1800);
    }

    function shareUrl(d) {
      return location.origin + location.pathname + "?d=" + encodeURIComponent(engine.encode(d));
    }

    function share() {
      if (!current) return;
      var url = shareUrl(current);
      var text = current.text;
      if (navigator.share) {
        navigator.share({ title: "What Should I Dream About?", text: text, url: url })
          .catch(function (e) { if (e && e.name !== "AbortError") copy(text + "\n\n" + url); });
      } else {
        copy(text + "\n\n" + url);
      }
    }

    function copy(s) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(
          function () { toast("Dream and link copied"); },
          function () { toast("Could not copy"); });
      } else {
        toast("Could not copy");
      }
    }

    // ---- parent gate: hold 3s, then a real link the grown-up taps --------
    var HOLD_MS = 3000, holdStart = 0, holdRaf = 0;
    var gate = $("gate"), gateScrim = $("gateScrim"), hold = $("hold"), holdFill = $("holdFill"), holdLbl = $("holdLbl"), gateGo = $("gateGo");

    function openGate() {
      if (!current || !current.character.watch) return;
      gateGo.href = current.character.watch;
      gateGo.textContent = "Open " + current.character.name.split(" ")[0] + " on YouTube";
      resetHold();
      hold.hidden = false; gateGo.hidden = true;
      $("gateMsg").textContent = "Press and hold the button for 3 seconds to continue.";
      gate.hidden = false; gateScrim.classList.add("on");
      hold.focus();
    }
    function closeGate() {
      cancelHold();
      gate.hidden = true; gateScrim.classList.remove("on");
      watchBtn.focus();
    }
    function resetHold() { holdFill.style.transform = "scaleX(0)"; holdLbl.textContent = "Hold to continue"; }
    function tick() {
      var p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      holdFill.style.transform = "scaleX(" + p + ")";
      if (p >= 1) {
        holdStart = 0;
        hold.hidden = true; gateGo.hidden = false;
        $("gateMsg").textContent = "Thanks. Tap below to open the video in a new tab.";
        gateGo.focus();
        return;
      }
      holdRaf = requestAnimationFrame(tick);
    }
    function startHold(e) {
      if (e) e.preventDefault();
      if (holdStart) return;
      holdStart = performance.now();
      holdLbl.textContent = "Keep holding\u2026";
      holdRaf = requestAnimationFrame(tick);
    }
    function cancelHold() {
      if (!holdStart) return;
      holdStart = 0;
      cancelAnimationFrame(holdRaf);
      resetHold();
    }
    hold.addEventListener("pointerdown", startHold);
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { hold.addEventListener(ev, cancelHold); });
    hold.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    hold.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) startHold(e); });
    hold.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") cancelHold(); });
    gateGo.addEventListener("click", function () { setTimeout(closeGate, 0); });
    $("gateClose").addEventListener("click", closeGate);
    gateScrim.addEventListener("click", closeGate);

    // ---- shelf ---------------------------------------------------------
    function keep() {
      if (!current) return;
      var code = engine.encode(current);
      if (shelf.some(function (s) { return s.code === code; })) return;
      shelf.unshift({ code: code, text: current.text, id: current.character.id, name: current.character.name, colour: current.character.palette[2] });
      shelf = shelf.slice(0, 60);
      save(SHELF_KEY, shelf);
      renderShelf();
      keepBtn.textContent = "Kept ✓";
      keepBtn.classList.add("kept");
    }

    function renderShelf() {
      $("shelfCount").textContent = shelf.length;
      var ul = $("savedList");
      ul.innerHTML = "";
      $("emptyMsg").hidden = shelf.length > 0;
      shelf.forEach(function (s, i) {
        var li = document.createElement("li");
        var dot = document.createElement("div");
        dot.className = "dot"; dot.style.background = s.colour;
        var p = document.createElement("p");
        p.textContent = s.text;
        var sp = document.createElement("span");
        sp.textContent = s.id + " · " + s.name;
        p.appendChild(sp);
        var x = document.createElement("button");
        x.className = "x"; x.type = "button"; x.textContent = "×";
        x.setAttribute("aria-label", "Remove this dream");
        x.addEventListener("click", function () {
          shelf.splice(i, 1);
          save(SHELF_KEY, shelf);
          renderShelf();
          if (current && s.code === engine.encode(current)) {
            keepBtn.textContent = "Keep this dream";
            keepBtn.classList.remove("kept");
          }
        });
        li.appendChild(dot); li.appendChild(p); li.appendChild(x);
        ul.appendChild(li);
      });
    }

    function openShelf(on) {
      $("shelf").classList.toggle("on", on);
      $("scrim").classList.toggle("on", on);
    }

    // ---- wiring --------------------------------------------------------
    moon.addEventListener("click", go);
    keepBtn.addEventListener("click", keep);
    shareBtn.addEventListener("click", share);
    watchBtn.addEventListener("click", openGate);
    $("mKin").addEventListener("click", function () { kindred = true; paintMode(); savePrefs(); });
    $("mAny").addEventListener("click", function () { kindred = false; paintMode(); savePrefs(); });
    biasInput.addEventListener("input", function () { bias = biasInput.value / 100; paintBias(); savePrefs(); });
    $("openShelf").addEventListener("click", function () { openShelf(true); });
    $("closeShelf").addEventListener("click", function () { openShelf(false); });
    $("scrim").addEventListener("click", function () { openShelf(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { openShelf(false); if (!gate.hidden) closeGate(); }
      if (e.key === " " && document.activeElement === document.body && gate.hidden) { e.preventDefault(); go(); }
    });

    renderShelf();
    paintMode();
    // Open on a shared dream if the link carries one, else the demo's opening dream.
    paint(engine.decode(params.get("d")) || engine.build(4, 0, 0), false);
  }

  // ---- starfield -------------------------------------------------------
  var cv = $("sky"), ctx = cv.getContext("2d"), stars = [], W = 0, H = 0;
  var tint = [42, 53, 102], target = [42, 53, 102];
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setTint(hex) {
    var n = parseInt(hex.slice(1), 16);
    target = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(150, (W * H) / 7000));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.35 + .25,
        a: Math.random() * .55 + .18,
        v: Math.random() * .045 + .008,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function frame() {
    for (var k = 0; k < 3; k++) tint[k] += (target[k] - tint[k]) * 0.022;
    var r = Math.round(tint[0]), g = Math.round(tint[1]), b = Math.round(tint[2]);
    ctx.clearRect(0, 0, W, H);
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgb(" + Math.round(r * .42) + "," + Math.round(g * .42) + "," + Math.round(b * .48) + ")");
    grad.addColorStop(1, "#0A0912");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (!reduce) { s.y += s.v; s.tw += 0.012; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; } }
      var a = s.a * (reduce ? 1 : (0.72 + 0.28 * Math.sin(s.tw)));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,253,246," + a.toFixed(3) + ")";
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  // ---- offline -----------------------------------------------------------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
