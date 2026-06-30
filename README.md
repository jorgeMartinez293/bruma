# ArchIpelago

Motor de **widgets de escritorio** para macOS, estilo [Übersicht]. Nativo (Swift +
WKWebView), ligero, con **fondo transparente real**: los widgets se dibujan directamente
sobre el wallpaper, detrás de los iconos, en todas las pantallas y Spaces.

Compatible con el formato de widget de Übersicht, así que los widgets `.jsx` existentes
corren sin cambios.

## Por qué nativo (y no Electron)

Los widgets corren en un webview (WebKit). Electron empaqueta Chromium → mucha RAM y binario
grande; ArchIpelago usa **WKWebView** = el WebKit del sistema → RAM baja, binario diminuto, y
**la misma capacidad de widgets** (cualquier HTML/CSS/JS/JSX). El propio Übersicht es nativo.

## Construir y ejecutar

```bash
# Desarrollo (vive mientras dure la terminal):
swift run

# App independiente, doble-clic, sin icono en el Dock:
./make_app.sh
open ArchIpelago.app
```

`ArchIpelago.app` es una *agent app* (`LSUIElement`): no aparece en el Dock, solo un icono en
la barra de menú. Para que arranque al iniciar sesión: Ajustes del Sistema → General →
Ítems de inicio → añadir `ArchIpelago.app`.

> **Permisos:** en el primer arranque macOS puede pedir acceso a carpetas (porque el `command`
> del widget corre en una shell de login `bash -l`). Acéptalo si tus widgets leen archivos.

## Menú de la barra

- **Modo edición (mover widgets)** — vuelve los widgets arrastrables; suelta para guardar la
  posición. Fuera de este modo, el escritorio es *click-through* (los clics pasan a los iconos).
- **Recargar widgets**
- **Abrir carpeta de widgets**
- **Salir**

## Crear un widget

Los widgets viven en:

```
~/Library/Application Support/ArchIpelago/widgets/
```

Layouts soportados (igual que Übersicht):

```
widgets/mi-widget/mi-widget.jsx      # carpeta con su .jsx (recomendado, permite assets)
widgets/mi-widget.jsx                # archivo suelto
```

La carpeta se vigila: al guardar un cambio, el widget se **recarga solo** (hot-reload).

### Formato (API compatible Übersicht)

```jsx
// Comando shell; su salida llega a render() como `output`.
export const command = "date +'%H:%M'";

// Cada cuánto re-ejecutar el comando (ms). `false` = solo una vez. Por defecto 1000.
export const refreshFrequency = 1000;

// CSS del widget. Las propiedades sueltas aplican al contenedor; los selectores
// anidados (.clase {}) aplican a sus hijos. Soporta @font-face con rutas relativas.
export const className = `
  top: 40px; left: 40px;
  color: white;
  .hora { font-size: 48px; font-weight: 800; }
`;

// React/JSX. Recibe { output, error }.
export const render = ({ output }) => (
  <div className="hora">{output}</div>
);
```

**Sin fondo:** no pongas `background` en `className`. El contenedor es transparente por defecto,
así que solo se ve lo que dibujes (texto, SVG, imágenes con transparencia…).

**Assets relativos** (fuentes, imágenes) se resuelven contra la carpeta del widget vía el
esquema interno `archw://`. Ej.: `@font-face { src: url('MiFuente.otf'); }`.

**Posición:** colócalo con `top/left/right/bottom` en `className`, o arrástralo en *modo edición*
(la posición arrastrada se guarda en `positions.json` y gana sobre el CSS).

## Arquitectura

- `Sources/ArchIpelago/` — capa nativa: ventana de escritorio transparente
  (`DesktopWindow`), host del webview (`WebHost`), ejecución de shell (`ShellRunner`),
  esquema de assets (`WidgetSchemeHandler`), watcher (`WidgetWatcher`), posiciones
  (`PositionStore`), menú/ciclo de vida (`AppDelegate`), una ventana por pantalla
  (`WindowManager`).
- `Sources/ArchIpelago/Resources/runtime/` — runtime web: `index.html` + `runtime.js`
  (transforma JSX con Babel, ejecuta el comando vía puente nativo, renderiza con React,
  inyecta el CSS y gestiona el arrastre). React/ReactDOM/Babel vendorizados en `vendor/`.

## Límites del MVP

- API soportado: `command` (string), `refreshFrequency`, `className` (string/array), `render`.
- `command` como función con `dispatch`, `initialState`/`updateState` y el helper `css` de
  emotion aún no están implementados (no los necesita el widget de reloj de prueba).

[Übersicht]: https://tracesof.net/uebersicht/
