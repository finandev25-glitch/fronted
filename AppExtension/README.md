# Voucher Side Panel

Extensión de navegador para mostrar el voucher y los datos clave del depósito en un panel lateral persistente.

## Instalación

1. Abre Chrome o Edge.
2. Ve a `chrome://extensions`.
3. Activa `Modo desarrollador`.
4. Haz clic en `Cargar descomprimida`.
5. Selecciona la carpeta `browser-extension/` de este proyecto.

## Instalación en Firefox

Firefox no soporta `chrome.sidePanel` (la API que usa el panel en Chrome) ni ejecuta
`service_worker` como background script -- por eso hay un `manifest.firefox.json`
aparte con las claves equivalentes de Firefox (`sidebar_action` en vez de
`side_panel`, `background.scripts` en vez de `service_worker`). El resto de los
archivos (`background.js`, `content-script.js`, `sidepanel.js/html/css`) son los
mismos para los dos navegadores -- `background.js` detecta en qué navegador está
corriendo y usa la API que corresponda, sin afectar el comportamiento en Chrome.

1. Copiá toda la carpeta `AppExtension/` a otra carpeta (por ejemplo `AppExtension-firefox/`).
2. En esa copia, borrá `manifest.json` y renombrá `manifest.firefox.json` a `manifest.json`.
3. Abrí Firefox y andá a `about:debugging#/runtime/this-firefox`.
4. Hacé clic en `Cargar complemento temporal...` y seleccioná el `manifest.json` de esa copia.
5. El ícono de la extensión abre el sidebar igual que en Chrome. También podés
   abrirlo manualmente desde `Ver > Barra lateral` en el menú de Firefox.

Nota: "Cargar complemento temporal" se borra al cerrar Firefox -- hay que
volver a cargarla cada vez. Para dejarla instalada de forma permanente hace
falta firmarla con Mozilla (o usar Firefox Developer Edition/Nightly con
`xpinstall.signatures.required` desactivado).

## Uso

1. Abre el sistema en `http://localhost:5173/`, `http://localhost:3000/` o en tu URL de EasyPanel.
2. En el modal del depósito, usa el botón `Panel Lateral`.
3. La extensión guarda el último voucher en `chrome.storage.local`.
4. Aunque cambies de página, el panel lateral sigue mostrando el último depósito cargado.
5. Si cambias el dominio del sistema, actualiza `browser-extension/manifest.json` y recarga la extensión.

## Flujo

- El frontend envía `LOAD_VOUCHER` con la URL y la metadata.
- El content script la recibe y la reenvía al service worker.
- El service worker guarda el estado y abre el side panel.
- El side panel lee el estado desde `chrome.storage.local`.

## Datos mostrados

- Fecha depósito
- Nro. operación solicitante
- Moneda
- Cliente
- Estado
- Sucursal
- Banco
