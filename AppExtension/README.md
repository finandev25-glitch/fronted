# Voucher Side Panel

Extensión de navegador para mostrar el voucher y los datos clave del depósito en un panel lateral persistente.

## Instalación

1. Abre Chrome o Edge.
2. Ve a `chrome://extensions`.
3. Activa `Modo desarrollador`.
4. Haz clic en `Cargar descomprimida`.
5. Selecciona la carpeta `AppExtension/` de este proyecto.

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
5. Si cambias el dominio del sistema, actualiza `AppExtension/manifest.json` (y `manifest.firefox.json`) y recarga la extensión.

## Validar y confirmar desde el panel (v1.2.0)

- **Fecha:** bajo el campo se indica si es la de hoy (verde), anterior
  (aviso ámbar: revisarla) o futura (rojo: error del voucher).
- **Cuenta del anexo:** al elegir el Anexo, se busca en la pestaña activa
  (la página del banco) la cuenta que le corresponde a esa Empresa + Anexo
  (tabla `ANEXO_VALIDATION_RULES` en `sidepanel.js`, la misma de la pantalla
  principal). La cuenta se compara por dígitos (encuentra `191-6661277-0-24`
  aunque el banco la muestre con otros guiones o espacios) y se resalta en
  verde en la página.
- **Botón "Validar":** revisa de una vez campos obligatorios, anexo vs.
  moneda, fecha, importe y nro. de operación en la página, y la cuenta del
  anexo. Muestra un resumen ✓ / ⚠ / ✗.
- **Botón "Confirmar":** corre la misma validación (si hay algún ✗ no deja
  seguir), pide confirmación ("¿Confirmar el depósito S/ … · Op. …?") y
  confirma. El panel no tiene sesión propia: le pide la confirmación a la
  pestaña de la **pantalla principal (Kanban)**, que debe seguir abierta —
  igual que hoy, ya que el depósito se manda al panel desde ahí. La app
  comprueba duplicados, confirma con la sesión del usuario, actualiza el
  Kanban, cierra el detalle y saca el depósito del panel.
  Flujo técnico: panel → `CONFIRM_QUEUE_ITEM` (background) →
  `CONFIRMO_CONFIRM_REQUEST` (content-script de la pestaña del sistema) →
  CustomEvent `confirmo:queue-confirm` → la app responde con
  `confirmo:queue-confirm-ack` y `confirmo:queue-confirm-result`.
- **Niubiz:** si el banco es Niubiz aparece el campo "Nº de tarjeta",
  obligatorio para confirmar.

## Flujo

- El frontend envía `confirmo:queue-add` (CustomEvent) con el depósito.
- El content script lo recibe y lo reenvía al service worker.
- El service worker guarda el estado y abre el side panel.
- El side panel lee el estado desde `chrome.storage.local`; lo que se edita
  vuelve a la app vía `confirmo:queue-updated`.

## Datos mostrados

- Fecha depósito
- Nro. operación solicitante
- Moneda
- Cliente
- Estado
- Sucursal
- Banco

## 1.3.0

- **Bitácora de horas-hombre:** el panel mide el tiempo por depósito (abierto, visible y activo) y las acciones (validar, buscar, confirmar). Como el panel no tiene sesión, los eventos se guardan en `deposit_events_outbox` (chrome.storage.local) y se entregan a la pestaña del sistema (`CONFIRMO_LOG_EVENTS` → `confirmo:log-deposit-events`), que los envía al backend con canal `appextension`. Si no hay pestaña del sistema abierta, se reintentan con el siguiente evento.
- **N° de operación del voucher:** el campo se marca en ámbar y no se puede confirmar mientras tenga el N° del voucher (hay que poner el del banco). La pantalla principal aplica la misma regla al recibir la confirmación.
- **Ctrl+Enter:** inicia la confirmación; un segundo Ctrl+Enter equivale a "Sí, confirmar".
