# Confirmo como extensión de Chrome

La aplicación completa se puede usar como **extensión de Chrome** (panel lateral),
reutilizando el "modo extensión" que ya trae el proyecto (`extension.html` →
`src/extension-entry.jsx`, ruteo con `HashRouter`, UI compacta).

## Cómo se arma

1. Configura la URL del backend en `fronted/.env` (obligatorio para la extensión,
   porque **no** existe el proxy `/api` de desarrollo):
   ```
   VITE_API_BASE_URL=https://tu-backend:puerto
   # opcional; si no, se deriva de VITE_API_BASE_URL + /hubs/deposits
   VITE_SIGNALR_HUB_URL=https://tu-backend:puerto/hubs/deposits
   ```
   Si no defines nada, `extension-entry.jsx` usa `http://192.168.85.50:3000` por
   defecto.

2. Compila:
   ```
   npm run build
   ```
   El resultado en `dist/` **ya es la extensión** (contiene `manifest.json`,
   `background.js`, `extension.html` y `assets/`). El manifest y el background
   viven en `public/`, así que Vite los copia a `dist/` en cada build.

## Cómo cargarla en Chrome

1. Abre `chrome://extensions/`.
2. Activa **Modo de desarrollador**.
3. **Cargar extensión sin empaquetar** → selecciona la carpeta **`dist/`**.
4. Fija la extensión y haz clic en su icono → se abre la app en el **panel lateral**.

## Notas / limitaciones

- **Backend accesible por HTTPS/host permitido:** la extensión hace `fetch` y
  WebSocket (SignalR) directo al backend. El `manifest.json` usa
  `host_permissions: ["<all_urls>"]` para permitirlo (uso interno). Puedes
  restringirlo al dominio real del backend si quieres menos permisos.
- **Login/sesión:** se guarda en `localStorage` del origen de la extensión
  (independiente del de la web). Tendrás que iniciar sesión dentro del panel.
- **Google Drive Picker:** esa librería usa `eval`, que la CSP de MV3 bloquea.
  El resto de la app funciona; solo esa función puntual del picker de Drive no
  estará disponible dentro de la extensión.
- **Panel angosto:** la app corre en modo compacto (pensado para el panel). Si
  prefieres abrirla a pantalla completa en una pestaña, se puede cambiar el
  `background.js` para hacer `chrome.tabs.create({ url: "extension.html" })` en
  vez del side panel.

## Archivos de la extensión (en `public/`, copiados a `dist/`)

- `public/manifest.json` — MV3, `side_panel` → `extension.html`.
- `public/background.js` — abre el panel lateral al clic del icono.
