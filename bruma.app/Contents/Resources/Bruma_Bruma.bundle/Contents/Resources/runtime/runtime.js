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
 * (position saved natively per instance), ✕ badge to remove.
 */
(function () {
  "use strict";

  var root = document.getElementById("root");
  var instances = []; // { id, widgetId, glass, interval, reactRoot, styleEl, wrap }
  var editMode = false;
  var snapToGrid = false;
  // Grid step = the margin between widgets (16px). Fine enough to nudge
  // widgets freely while keeping edges and gaps on a consistent rhythm: the
  // small widgets (170) and the long Claude widget (356 = 170 + 170 + 16) all
  // line up cleanly on this step.
  var GRID = 15; // px; drag positions snap to multiples of this when enabled

  function snap(v) { return snapToGrid ? Math.round(v / GRID) * GRID : v; }

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

  var backdropObserver = new ResizeObserver(syncBackdrops);

  // ---- edit mode: drag + remove --------------------------------------------

  function beginDrag(inst, e) {
    if (!editMode || e.button !== 0) return;
    if (e.target.closest(".bruma-remove")) return;
    e.preventDefault();

    var rect = inst.wrap.getBoundingClientRect();
    var dx = e.clientX - rect.left;
    var dy = e.clientY - rect.top;

    // Pin the current spot as left/top so widgets positioned via CSS
    // right/bottom don't jump when we start writing left/top.
    inst.wrap.style.left = rect.left + "px";
    inst.wrap.style.top = rect.top + "px";
    inst.wrap.style.right = "auto";
    inst.wrap.style.bottom = "auto";
    inst.wrap.classList.add("dragging");

    function move(ev) {
      inst.wrap.style.left = snap(ev.clientX - dx) + "px";
      inst.wrap.style.top = snap(ev.clientY - dy) + "px";
      syncBackdrops();
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      inst.wrap.classList.remove("dragging");
      var r = inst.wrap.getBoundingClientRect();
      notify("moveInstance", { id: inst.id, x: snap(r.left), y: snap(r.top) });
      syncBackdrops();
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
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

    if (typeof data.x === "number" && typeof data.y === "number") {
      wrap.style.left = data.x + "px";
      wrap.style.top = data.y + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    }

    // React owns `body`'s children, so the remove badge lives as a sibling
    // overlay next to the mount node instead of inside it.
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

    var inst = { id: data.id, widgetId: preset.id, glass: widget.glass,
                 interval: null, reactRoot: null, styleEl: styleEl, wrap: wrap };
    wrap.addEventListener("mousedown", function (e) { beginDrag(inst, e); });

    root.appendChild(wrap);

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
    if (widget.glass) backdropObserver.observe(wrap);
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
    backdropObserver.disconnect();
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
