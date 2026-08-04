/* Bruma widget picker — the gallery drawer.
 *
 * Renders one card per widget preset with a live, scaled-down preview
 * (same evaluation pipeline as the desktop runtime, but a single render —
 * no refresh intervals, no native glass). Clicking a card asks the native
 * side to place a new instance on the desktop.
 */
(function () {
  "use strict";

  function call(action, extra) {
    var msg = Object.assign({ action: action }, extra || {});
    return window.webkit.messageHandlers.arch.postMessage(msg);
  }
  function notify(action, extra) {
    var msg = Object.assign({ action: action }, extra || {});
    window.webkit.messageHandlers.archNotify.postMessage(msg);
  }

  // ---- widget evaluation (mirror of runtime.js, minus intervals) -----------

  var uebersichtModule = {
    React: window.React,
    ReactDOM: window.ReactDOM,
    run: function (command) {
      return call("shell", { id: "__run__", command: command }).then(function (r) {
        return (r && r.output) || "";
      });
    },
    css: function () { return ""; },
    styled: {}
  };

  function fakeRequire(name) {
    if (name === "react") return Object.assign({ default: window.React }, window.React);
    if (name === "react-dom") return Object.assign({ default: window.ReactDOM }, window.ReactDOM);
    if (name === "uebersicht" || name === "Uebersicht") return uebersichtModule;
    throw new Error("Bruma: cannot require '" + name + "'");
  }

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
    var def = (exp && exp.default && typeof exp.default === "object") ? exp.default : {};
    function pick(a, b) { return a !== undefined ? a : b; }
    return {
      command: pick(exp.command, def.command),
      className: pick(exp.className, def.className),
      render: pick(exp.render, def.render),
      glass: pick(exp.glass, def.glass)
    };
  }

  function rewriteUrls(css, widgetId) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, p) {
      if (/^(https?:|data:|archw:|\/)/.test(p)) return m;
      return "url(" + q + "archw://widget/" + widgetId + "/" + p + q + ")";
    });
  }

  function safeId(id) { return "pv_" + id.replace(/[^A-Za-z0-9_-]/g, "_"); }

  function buildStyle(widgetId, className) {
    var cssText = Array.isArray(className) ? className.join("\n") : (className || "");
    var style = document.createElement("style");
    style.textContent = "#" + safeId(widgetId) + " {\n" +
      rewriteUrls(cssText, widgetId) + "\n}\n";
    return style;
  }

  // ---- preview cards --------------------------------------------------------

  function fitPreview(stage, pv) {
    // Measure after render, then centre + scale the widget to fit the stage.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var w = pv.offsetWidth, h = pv.offsetHeight;
        if (!w || !h) return;
        var pad = 0.82;
        var scale = Math.min((stage.clientWidth * pad) / w,
                             (stage.clientHeight * pad) / h, 1);
        pv.style.left = "50%";
        pv.style.top = "50%";
        pv.style.right = "auto";
        pv.style.bottom = "auto";
        pv.style.margin = "0";
        pv.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
      });
    });
  }

  function buildCard(preset) {
    var card = document.createElement("div");
    card.className = "card";
    card.title = preset.id;

    var stage = document.createElement("div");
    stage.className = "stage";
    var name = document.createElement("div");
    name.className = "name";
    name.textContent = preset.id;
    card.appendChild(stage);
    card.appendChild(name);

    var widget;
    try {
      widget = evaluateWidget(preset.source);
    } catch (e) {
      stage.textContent = "⚠︎";
      return card;
    }

    document.head.appendChild(buildStyle(preset.id, widget.className));

    var pv = document.createElement("div");
    pv.className = "pv";
    pv.id = safeId(preset.id);
    if (widget.glass) {
      pv.classList.add("preview-glass");
      if (typeof widget.glass === "number") pv.style.borderRadius = widget.glass + "px";
    }
    stage.appendChild(pv);

    var reactRoot = window.ReactDOM.createRoot(pv);
    function draw(output, error) {
      if (typeof widget.render !== "function") return;
      try {
        reactRoot.render(widget.render({ output: output, error: error }));
      } catch (e) {
        reactRoot.render(window.React.createElement(
          "pre", { style: { color: "#f55", font: "10px monospace" } }, String(e)));
      }
      fitPreview(stage, pv);
    }

    // One shot — a static preview is enough for the gallery.
    if (typeof widget.command === "string" && widget.command.trim()) {
      call("shell", { id: preset.id, command: widget.command }).then(function (r) {
        draw((r && r.output) || "", (r && r.error) || "");
      });
    } else {
      draw("", "");
    }

    // Placement has two gestures on the same card:
    //   · a plain click drops the widget at the cascade centre (native decides);
    //   · a drag pulls it off the shelf — once the pointer moves past a small
    //     threshold we hand off to a native drag ghost that carries the preview
    //     across windows and places the instance wherever it's released.
    // We can't drag across to the desktop in HTML (separate WKWebViews), so the
    // native side owns everything after `beginCardDrag`.
    function placeCentered() {
      call("addInstance", { widget: preset.id }).then(function () {
        card.classList.remove("added");
        void card.offsetWidth; // restart the pop animation
        card.classList.add("added");
      });
    }

    var DRAG_THRESHOLD = 6; // px before a press becomes a drag
    card.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var rect = card.getBoundingClientRect();
      var startX = e.clientX, startY = e.clientY;
      var grabX = startX - rect.left, grabY = startY - rect.top;
      var dragging = false;

      function move(ev) {
        if (dragging) return;
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD &&
            Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        card.classList.add("lifted");
        notify("beginCardDrag", {
          widget: preset.id,
          rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
          grabX: grabX, grabY: grabY
        });
        // Native tracking takes over from here (the pointer will leave this
        // window); we only needed to detect the drag and suppress the click.
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (!dragging) placeCentered();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });

    return card;
  }

  function refresh() {
    var cards = document.getElementById("cards");
    cards.textContent = "";
    call("listWidgets").then(function (widgets) {
      widgets = widgets || [];
      if (!widgets.length) {
        var empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No widgets in the folder. Add <name>/<name>.jsx folders.";
        cards.appendChild(empty);
        return;
      }
      widgets.forEach(function (p) { cards.appendChild(buildCard(p)); });
    });
  }

  // ---- header toggles -------------------------------------------------------

  var syncInput = document.getElementById("syncInput");
  call("getSyncMonitors").then(function (on) {
    syncInput.checked = on !== false; // default on
  });
  syncInput.addEventListener("change", function () {
    notify("setSyncMonitors", { value: syncInput.checked });
  });

  var snapInput = document.getElementById("snapInput");
  call("getSnapToGrid").then(function (on) {
    snapInput.checked = on === true; // default off
  });
  snapInput.addEventListener("change", function () {
    notify("setSnapToGrid", { value: snapInput.checked });
  });

  document.getElementById("close").addEventListener("click", function () {
    notify("closePicker");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") notify("closePicker");
  });

  // Native calls this when a shelf drag ends, so the lifted card settles back.
  function dragEnded() {
    var lifted = document.querySelectorAll(".card.lifted");
    for (var i = 0; i < lifted.length; i++) lifted[i].classList.remove("lifted");
  }

  window.__picker = { refresh: refresh, dragEnded: dragEnded };
  refresh();
})();
