# Confirmo - Control de Depósitos (Firefox)

Copia de `ExtensionPanelPrueba/` (la extensión de Chrome) adaptada para
Firefox. La carpeta original queda intacta -- esta es la que se carga en
Firefox.

## Qué cambia respecto a la versión de Chrome

Firefox no implementa `chrome.sidePanel` (API exclusiva de Chrome/Edge) ni
ejecuta `service_worker` como background script de la misma forma. Por eso:

- `manifest.json`: `"side_panel"` -> `"sidebar_action"`, `"background":
  { "service_worker": ... }` -> `"background": { "scripts": [...], "type":
  "module" }`, se agrega `browser_specific_settings.gecko` (id + versión
  mínima) y se quita el permiso `"sidePanel"` (no existe en Firefox).
- `background.js`: se agrega la detección `isFirefox` y, cuando corresponde,
  un listener `chrome.action.onClicked` que llama a
  `browser.sidebarAction.open()` -- Firefox no tiene el equivalente de
  `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, así que sin
  esto el ícono no abriría nada al hacer clic.
- `manifest.json` también declara `data_collection_permissions` (requerido
  por Mozilla desde el 3/nov/2025 para todo complemento nuevo, ver
  https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/):
  `authenticationInfo`, `financialAndPaymentInfo` y `personallyIdentifyingInfo`
  como "required", porque el panel carga la app de Confirmo completa (login,
  montos/operaciones bancarias, nombres de cliente/trabajador) y esos datos
  sí viajan al backend de Confirmo. Por eso también se subió
  `strict_min_version` a `140.0` -- versión mínima de Firefox que soporta el
  aviso de consentimiento integrado para esa declaración.

El resto de los archivos (`extension.html`, los bundles en `assets/`, la
lógica de búsqueda en la pestaña activa) son exactamente los mismos que en
`ExtensionPanelPrueba/` -- no necesitan cambios porque usan `chrome.runtime`,
`chrome.tabs` y `chrome.scripting`, que Firefox también expone bajo el mismo
namespace `chrome.*`.

## Cómo cargarla en Firefox

1. Abrí Firefox y andá a `about:debugging#/runtime/this-firefox`.
2. Hacé clic en `Cargar complemento temporal...` y seleccioná el
   `manifest.json` de esta carpeta.
3. El ícono de la extensión abre el sidebar. También se puede abrir
   manualmente desde `Ver > Barra lateral` en el menú de Firefox.

Nota: "Cargar complemento temporal" se borra al cerrar Firefox -- hay que
volver a cargarla cada vez. Para dejarla instalada de forma permanente hace
falta firmarla con Mozilla (o usar Firefox Developer Edition/Nightly con
`xpinstall.signatures.required` desactivado) -- mismo proceso documentado en
`AppExtension/README.md`.

## Si el frontend se reconstruye (nuevo build)

Los archivos en `assets/`, `extension.html` e `index.html` son el build de
Vite de la app (nombres con hash). Si se genera un build nuevo de
`ExtensionPanelPrueba/`, hay que volver a copiar esos archivos acá (pisando
los de esta carpeta) y no tocar `manifest.json` ni los cambios de
`background.js` descritos arriba.
