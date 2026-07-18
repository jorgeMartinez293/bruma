# Widgets

Widgets listos para usar con bruma. Cada carpeta es un widget autocontenido.

| Widget | Qué hace |
|---|---|
| [`bruma-clock`](bruma-clock/) | Reloj analógico 1×1 con fondo Liquid Glass; colores siguen el tema del sistema. |
| [`bruma-month`](bruma-month/) | Mes actual en grande con 12 marcas tipo esfera, 1×1, Liquid Glass. |
| [`bruma-cpu`](bruma-cpu/) | Uso de CPU de los últimos ~2 minutos (área + línea), 2×1, Liquid Glass. |

## Instalar

Copia la carpeta del widget a la carpeta de widgets de bruma:

```bash
cp -R bruma-clock ~/Library/Application\ Support/Bruma/widgets/
```

O desde el menú de la barra: **Abrir carpeta de widgets** → arrastra la carpeta ahí.
bruma detecta el cambio y carga el widget al momento (hot-reload), sin reiniciar.

Si no tienes el repositorio clonado, puedes descargar solo un widget desde GitHub:
entra en la carpeta del widget, abre el `.jsx`, botón **Raw** → guardar como
`nombre-del-widget/nombre-del-widget.jsx` dentro de la carpeta de widgets.

## Colocación

Cada widget trae una posición por defecto (`top`/`left` en su `className`). Para moverlo,
usa el **modo edición** del menú de la barra y arrástralo; la posición se guarda sola.

Los tres widgets están pensados como rejilla estilo macOS: `bruma-clock` y `bruma-month`
arriba (1×1 cada uno) y `bruma-cpu` debajo (2×1), con 16 px de separación.
