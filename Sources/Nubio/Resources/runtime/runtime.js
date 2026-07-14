/* Nubio widget runtime — loads Übersicht-style widgets in WKWebView.
 *
 * Per widget:
 *   1. Babel-transform the JSX/ESM source, eval it as a CommonJS module.
 *   2. Read exports: command, refreshFrequency, className, render.
 *   3. Run `command` via the native shell bridge on an interval; pass
 *      { output, error } to render(); mount with React.
 *   4. Inject `className` as CSS scoped to the widget's wrapper.
 */
(function () {
  "use strict";

  var root = document.getElementById("root");
  var instances = []; // { interval, reactRoot, styleEl, wrap }

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
    throw new Error("Nubio: cannot require '" + name + "'");
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
      render: pick(exp.render, def.render)
    };
  }
  function pick(a, b) { return a !== undefined ? a : b; }

  // ---- CSS scoping ----------------------------------------------------------

  function rewriteUrls(css, id) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, p) {
      if (/^(https?:|data:|archw:|\/)/.test(p)) return m;
      return "url(" + q + "archw://widget/" + id + "/" + p + q + ")";
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

  function buildStyle(id, className) {
    var cssText = Array.isArray(className) ? className.join("\n") : (className || "");
    var parts = extractAtRules(rewriteUrls(cssText, id));
    var sel = "#" + safeId(id);
    var style = document.createElement("style");
    // Relies on native CSS nesting (Safari 17+) for the nested selectors.
    style.textContent = parts.globals + "\n" + sel + " {\n" + parts.rest + "\n}\n";
    return style;
  }

  // ---- mount one widget -----------------------------------------------------

  function mountWidget(item, positions) {
    var widget;
    try {
      widget = evaluateWidget(item.source);
    } catch (e) {
      log("widget '" + item.id + "' failed to load:", String(e));
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "widget";
    wrap.id = safeId(item.id);

    var styleEl = buildStyle(item.id, widget.className);
    document.head.appendChild(styleEl);

    var pos = positions[item.id];
    if (pos) { wrap.style.left = pos.x + "px"; wrap.style.top = pos.y + "px"; }

    root.appendChild(wrap);

    var reactRoot = window.ReactDOM.createRoot(wrap);

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
        call("shell", { id: item.id, command: cmd }).then(function (r) {
          draw((r && r.output) || "", (r && r.error) || "");
        });
      } else {
        draw("", "");
      }
    }

    var interval = null;
    tick();
    var freq = widget.refreshFrequency;
    if (freq !== false) {
      var ms = (typeof freq === "number" && freq > 0) ? freq : 1000;
      interval = setInterval(tick, ms);
    }

    instances.push({ interval: interval, reactRoot: reactRoot, styleEl: styleEl, wrap: wrap });
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
  }

  function start() {
    Promise.all([call("getPositions"), call("listWidgets")]).then(function (res) {
      var positions = res[0] || {};
      var widgets = res[1] || [];
      widgets.forEach(function (item) { mountWidget(item, positions); });
      log("loaded " + widgets.length + " widget(s)");
    }).catch(function (e) { log("start failed:", String(e)); });
  }

  window.__arch = {
    reloadAll: function () { teardown(); start(); }
  };

  start();
})();
