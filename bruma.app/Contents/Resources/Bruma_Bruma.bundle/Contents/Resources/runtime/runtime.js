/* Bruma widget runtime — loads Übersicht-style widgets in WKWebView.
 *
 * Widgets are *presets*; what gets mounted are *instances* (a preset placed
 * at a position, any number of times). Per instance:
 *   1. Babel-transform the preset's JSX/ESM source, eval it as a CommonJS module.
 *   2. Read exports: command, refreshFrequency, className, render.
 *   3. Run `command` via the native shell bridge on an interval; pass
 *      { output, error } to render(); mount with React.
 *   4. Inject `className` as CSS scoped to the instance's wrapper.
 *
 * Edit mode (picker drawer open): instances become clickable — drag to move
 * (position saved natively per instance), − badge to remove, 3×3 badge to pick
 * the anchor the saved position refers to.
 */
(function () {
  "use strict";

  var root = document.getElementById("root");
  // { id, widgetId, glass, interval, reactRoot, styleEl, wrap, x, y, anchor,
  //   dragging }
  var instances = [];
  var editMode = false;
  var snapToGrid = false;
  // Grid step = the margin between widgets (16px). Fine enough to nudge
  // widgets freely while keeping edges and gaps on a consistent rhythm: the
  // small widgets (170) and the long Claude widget (356 = 170 + 170 + 16) all
  // line up cleanly on this step.
  var GRID = 15; // px; drag positions snap to multiples of this when enabled

  function snap(v) { return snapToGrid ? Math.round(v / GRID) * GRID : v; }

  // ---- anchors --------------------------------------------------------------
  // A saved position is a single point, and until now that point was always the
  // widget's top-left corner: a widget whose content grew (a longer line of
  // output, an extra row) pushed its right and bottom edges outwards and drifted
  // out of alignment with everything around it. Each instance now also stores
  // *which* point of its box that position pins down. On every resize we
  // re-derive left/top from the anchor, so the widget grows away from the
  // anchored corner/edge and the anchored point itself never moves.
  //
  // Positions stay in *layout* space (offsetLeft/offsetTop), the same space the
  // drag code uses, so a widget's own CSS transform keeps working untouched.

  var ANCHORS = ["top-left", "top", "top-right",
                 "left", "center", "right",
                 "bottom-left", "bottom", "bottom-right"];

  // Fractions of the box width/height the anchor sits at: 0, 0.5 or 1.
  function anchorFactors(anchor) {
    var i = ANCHORS.indexOf(anchor);
    if (i < 0) i = 0; // unknown / missing = top-left, the legacy behaviour
    return [(i % 3) / 2, Math.floor(i / 3) / 2];
  }

  // Places the wrapper so its anchor point lands on the saved coordinates.
  function applyPosition(inst) {
    if (inst.dragging) return; // the drag already owns left/top
    if (typeof inst.x !== "number" || typeof inst.y !== "number") return;
    var f = anchorFactors(inst.anchor);
    var left = (inst.x - f[0] * inst.wrap.offsetWidth) + "px";
    var top = (inst.y - f[1] * inst.wrap.offsetHeight) + "px";
    // Only write on a real change: this runs from a ResizeObserver, and a
    // widget sized by its content could otherwise ping-pong between two layouts.
    if (inst.wrap.style.left === left && inst.wrap.style.top === top) return;
    inst.wrap.style.left = left;
    inst.wrap.style.top = top;
    inst.wrap.style.right = "auto";
    inst.wrap.style.bottom = "auto";
  }

  // The anchor point of the box where it currently sits.
  function anchorPoint(inst) {
    var f = anchorFactors(inst.anchor);
    return [inst.wrap.offsetLeft + f[0] * inst.wrap.offsetWidth,
            inst.wrap.offsetTop + f[1] * inst.wrap.offsetHeight];
  }

  // Switching anchors must not move the widget: keep the box where it is and
  // re-measure the saved point against the new anchor.
  function setAnchor(inst, anchor) {
    inst.anchor = anchor;
    var p = anchorPoint(inst);
    inst.x = p[0];
    inst.y = p[1];
    markAnchor(inst);
    notify("setInstanceAnchor", { id: inst.id, anchor: anchor, x: inst.x, y: inst.y });
  }

  // ---- native bridges -------------------------------------------------------

  function call(action, extra) {
    var msg = Object.assign({ action: action }, extra || {});
    return window.webkit.messageHandlers.arch.postMessage(msg);
  }
  function notify(action, extra) {
    var msg = Object.assign({ action: action }, extra || {});
    window.webkit.messageHandlers.archNotify.postMessage(msg);
  }
  function log() {
    notify("log", { message: Array.prototype.join.call(arguments, " ") });
  }

  // ---- minimal `uebersicht` module for widget `require`/`import` ------------

  var uebersichtModule = {
    React: window.React,
    ReactDOM: window.ReactDOM,
    run: function (command) {
      return call("shell", { id: "__run__", command: command }).then(function (r) {
        return (r && r.output) || "";
      });
    },
    // Best-effort stub: returns the raw CSS string as a class name is not
    // supported here; widgets relying on emotion `css` are a known MVP gap.
    css: function () { return ""; },
    styled: {}
  };

  function fakeRequire(name) {
    if (name === "react") return Object.assign({ default: window.React }, window.React);
    if (name === "react-dom") return Object.assign({ default: window.ReactDOM }, window.ReactDOM);
    if (name === "uebersicht" || name === "Uebersicht") return uebersichtModule;
    throw new Error("Bruma: cannot require '" + name + "'");
  }

  // ---- widget module evaluation --------------------------------------------

  function evaluateWidget(source) {
    var transformed = window.Babel.transform(source, {
      presets: ["env", "react"],
      sourceType: "module",
      compact: false
    }).code;
    var module = { exports: {} };
    var fn = new Function("module", "exports", "require", transformed);
    fn(module, module.exports, fakeRequire);
    var exp = module.exports;
    // Support default-export object as well as named exports.
    var def = (exp && exp.default && typeof exp.default === "object") ? exp.default : {};
    return {
      command: pick(exp.command, def.command),
      refreshFrequency: pick(exp.refreshFrequency, def.refreshFrequency),
      className: pick(exp.className, def.className),
      render: pick(exp.render, def.render),
      // Bruma extension: `export const glass = true` (or a number to override
      // the corner radius) asks the native side for a Liquid Glass backdrop.
      glass: pick(exp.glass, def.glass)
    };
  }
  function pick(a, b) { return a !== undefined ? a : b; }

  // ---- CSS scoping ----------------------------------------------------------

  function rewriteUrls(css, widgetId) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, p) {
      if (/^(https?:|data:|archw:|\/)/.test(p)) return m;
      return "url(" + q + "archw://widget/" + widgetId + "/" + p + q + ")";
    });
  }

  // Pull top-level @font-face / @keyframes out so they apply globally
  // (they cannot live nested inside the widget's scope rule).
  function extractAtRules(css) {
    var globals = "", rest = "", i = 0;
    function at(tok) { return css.substr(i, tok.length) === tok; }
    while (i < css.length) {
      if (at("@font-face") || at("@keyframes") || at("@-webkit-keyframes")) {
        var brace = css.indexOf("{", i);
        if (brace < 0) { rest += css.slice(i); break; }
        var depth = 0, j = brace;
        for (; j < css.length; j++) {
          if (css[j] === "{") depth++;
          else if (css[j] === "}") { depth--; if (depth === 0) { j++; break; } }
        }
        globals += css.slice(i, j) + "\n";
        i = j;
      } else {
        rest += css[i]; i++;
      }
    }
    return { globals: globals, rest: rest };
  }

  function safeId(id) { return "wid_" + id.replace(/[^A-Za-z0-9_-]/g, "_"); }

  // Scope selector uses the *instance* id; asset URLs use the *widget* id.
  function buildStyle(instanceId, widgetId, className) {
    var cssText = Array.isArray(className) ? className.join("\n") : (className || "");
    var parts = extractAtRules(rewriteUrls(cssText, widgetId));
    var sel = "#" + safeId(instanceId);
    var style = document.createElement("style");
    // Relies on native CSS nesting (Safari 17+) for the nested selectors.
    style.textContent = parts.globals + "\n" + sel + " {\n" + parts.rest + "\n}\n";
    return style;
  }

  // ---- native glass backdrops ----------------------------------------------
  // Report the frame of every glass-enabled instance so AppKit can place a real
  // material view (Liquid Glass) behind the transparent webview. CSS
  // backdrop-filter cannot blur the wallpaper — only native views can.

  var backdropRAF = null;

  function syncBackdrops() {
    if (backdropRAF) return;
    backdropRAF = requestAnimationFrame(function () {
      backdropRAF = null;
      var frames = [];
      instances.forEach(function (inst) {
        if (!inst.glass) return;
        var rect = inst.wrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var radius = typeof inst.glass === "number"
          ? inst.glass
          : parseFloat(getComputedStyle(inst.wrap).borderTopLeftRadius) || 0;
        frames.push({ id: inst.id, x: rect.left, y: rect.top,
                      w: rect.width, h: rect.height, r: radius });
      });
      notify("backdrops", { frames: frames });
    });
  }

  // Every instance is observed: a size change re-runs the anchor math (so the
  // widget expands away from its anchor) and refreshes the glass frames.
  var sizeObserver = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var inst = entry.target.__brumaInstance;
      if (inst) applyPosition(inst);
    });
    syncBackdrops();
  });

  // ---- edit mode: drag + remove --------------------------------------------

  function beginDrag(inst, e) {
    if (!editMode || e.button !== 0) return;
    if (e.target.closest(".bruma-remove") || e.target.closest(".bruma-anchor")) return;
    e.preventDefault();

    // Drag in *layout* space (offsetLeft/offsetTop), not visual space
    // (getBoundingClientRect). A widget's own CSS may carry a transform — the
    // Übersicht centring idiom `top: 20%; left: 50%; transform: translate(-50%,
    // -50%)` is common — and a transform moves the painted box without moving
    // the layout box that `left`/`top` set. Saving the visual origin and later
    // restoring it as `left`/`top` applies that translation a second time, so
    // the widget crept up-left on every remount. #root is inset:0, so layout
    // coords share the origin with clientX/Y and the two only differ by
    // whatever transform the widget itself declares.
    var x0 = inst.wrap.offsetLeft;
    var y0 = inst.wrap.offsetTop;
    var dx = e.clientX - x0;
    var dy = e.clientY - y0;

    // Pin the current spot as left/top so widgets positioned via CSS
    // right/bottom don't jump when we start writing left/top.
    inst.wrap.style.left = x0 + "px";
    inst.wrap.style.top = y0 + "px";
    inst.wrap.style.right = "auto";
    inst.wrap.style.bottom = "auto";
    inst.wrap.classList.add("dragging");
    inst.dragging = true;

    function move(ev) {
      inst.wrap.style.left = snap(ev.clientX - dx) + "px";
      inst.wrap.style.top = snap(ev.clientY - dy) + "px";
      syncBackdrops();
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      inst.wrap.classList.remove("dragging");
      inst.dragging = false;
      // Snapping keeps the box itself on the grid; what gets saved is the
      // anchor point of the box where it came to rest.
      var p = anchorPoint(inst);
      inst.x = p[0];
      inst.y = p[1];
      notify("moveInstance", { id: inst.id, x: inst.x, y: inst.y });
      syncBackdrops();
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // ---- edit mode: anchor badge ---------------------------------------------
  // A 3×3 grid of cells mirroring the nine anchors; the lit cell is the current
  // one. Only visible in edit mode, next to the remove badge.

  function buildAnchorBadge(inst) {
    var badge = document.createElement("div");
    badge.className = "bruma-anchor";
    ANCHORS.forEach(function (anchor) {
      var cell = document.createElement("div");
      cell.className = "bruma-anchor-cell";
      cell.dataset.anchor = anchor;
      cell.title = "Anclar a: " + anchor;
      cell.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      cell.addEventListener("click", function (e) {
        e.stopPropagation();
        setAnchor(inst, anchor);
      });
      badge.appendChild(cell);
    });
    inst.anchorBadge = badge;
    markAnchor(inst);
    return badge;
  }

  function markAnchor(inst) {
    if (!inst.anchorBadge) return;
    var cells = inst.anchorBadge.children;
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle("on", cells[i].dataset.anchor === inst.anchor);
    }
  }

  // ---- mount one instance ---------------------------------------------------

  function mountInstance(preset, data) {
    var widget;
    try {
      widget = evaluateWidget(preset.source);
    } catch (e) {
      log("widget '" + preset.id + "' failed to load:", String(e));
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "widget";
    wrap.id = safeId(data.id);

    var styleEl = buildStyle(data.id, preset.id, widget.className);
    document.head.appendChild(styleEl);

    var inst = { id: data.id, widgetId: preset.id, glass: widget.glass,
                 interval: null, reactRoot: null, styleEl: styleEl, wrap: wrap,
                 x: data.x, y: data.y, anchor: data.anchor || ANCHORS[0],
                 dragging: false };
    wrap.__brumaInstance = inst;

    if (typeof data.x === "number" && typeof data.y === "number") {
      // Provisional top-left placement; applyPosition corrects for the anchor
      // once the box has been laid out (and again on every later resize).
      wrap.style.left = data.x + "px";
      wrap.style.top = data.y + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    }

    // React owns `body`'s children, so the edit-mode badges live as sibling
    // overlays next to the mount node instead of inside it.
    var body = document.createElement("div");
    body.className = "widget-body";
    wrap.appendChild(body);

    var removeBtn = document.createElement("div");
    removeBtn.className = "bruma-remove";
    removeBtn.textContent = "−"; // minus sign, like native macOS widgets
    removeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      notify("removeInstance", { id: data.id });
    });
    wrap.appendChild(removeBtn);
    wrap.appendChild(buildAnchorBadge(inst));

    wrap.addEventListener("mousedown", function (e) { beginDrag(inst, e); });

    root.appendChild(wrap);
    applyPosition(inst);

    var reactRoot = window.ReactDOM.createRoot(body);
    inst.reactRoot = reactRoot;

    function draw(output, error) {
      if (typeof widget.render !== "function") return;
      try {
        reactRoot.render(widget.render({ output: output, error: error }));
      } catch (e) {
        reactRoot.render(window.React.createElement(
          "pre", { style: { color: "#f55", font: "11px monospace" } }, String(e)));
      }
    }

    function tick() {
      var cmd = widget.command;
      if (typeof cmd === "string" && cmd.trim()) {
        // Shell cwd resolves from the *preset* id (the widget's folder).
        call("shell", { id: preset.id, command: cmd }).then(function (r) {
          draw((r && r.output) || "", (r && r.error) || "");
        });
      } else {
        draw("", "");
      }
    }

    tick();
    var freq = widget.refreshFrequency;
    if (freq !== false) {
      var ms = (typeof freq === "number" && freq > 0) ? freq : 1000;
      inst.interval = setInterval(tick, ms);
    }

    instances.push(inst);
    sizeObserver.observe(wrap);
  }

  // ---- lifecycle ------------------------------------------------------------

  function teardown() {
    instances.forEach(function (inst) {
      if (inst.interval) clearInterval(inst.interval);
      try { inst.reactRoot.unmount(); } catch (e) {}
      if (inst.styleEl && inst.styleEl.parentNode) inst.styleEl.parentNode.removeChild(inst.styleEl);
      if (inst.wrap && inst.wrap.parentNode) inst.wrap.parentNode.removeChild(inst.wrap);
    });
    instances = [];
    sizeObserver.disconnect();
    syncBackdrops();
  }

  function setEditMode(on) {
    editMode = !!on;
    document.body.classList.toggle("edit", editMode);
  }

  function setSnapToGrid(on) {
    snapToGrid = !!on;
    document.body.style.setProperty("--grid", GRID + "px");
    document.body.classList.toggle("snap", snapToGrid);
  }

  function start() {
    Promise.all([call("listWidgets"),
                 call("listInstances", { screen: window.__brumaScreen }),
                 call("getEditMode"),
                 call("getSnapToGrid")])
      .then(function (res) {
        var presets = {};
        (res[0] || []).forEach(function (p) { presets[p.id] = p; });
        var placed = res[1] || [];
        setEditMode(res[2]);
        setSnapToGrid(res[3]);
        placed.forEach(function (data) {
          var preset = presets[data.widget];
          if (preset) mountInstance(preset, data);
        });
        syncBackdrops();
        log("loaded " + placed.length + " instance(s)");
      }).catch(function (e) { log("start failed:", String(e)); });
  }

  window.__arch = {
    reloadAll: function () { teardown(); start(); },
    setEditMode: setEditMode,
    setSnapToGrid: setSnapToGrid
  };

  start();
})();
