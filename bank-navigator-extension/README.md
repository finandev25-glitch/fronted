# Navegador de Bancos - Perú (extensión Chrome)

Extensión de Chrome (Manifest V3) que muestra un **panel lateral** para navegar
los portales de los bancos de Perú **embebidos**, quitando las cabeceras
(`X-Frame-Options` / `Content-Security-Policy: frame-ancestors`) que normalmente
bloquean su carga dentro de un iframe.

> ⚠️ **Uso interno.** Quitar esas cabeceras evita una protección de seguridad de
> los bancos. Úsalo solo como herramienta operativa propia.

## Instalación (modo desarrollador)

1. Abre `chrome://extensions/`.
2. Activa **"Modo de desarrollador"** (arriba a la derecha).
3. Clic en **"Cargar extensión sin empaquetar"** (Load unpacked).
4. Selecciona esta carpeta `bank-navigator-extension/`.
5. Fija la extensión y haz clic en su icono → se abre el **panel lateral**.

## Uso

- Botones de colores = acceso directo a cada banco.
- Barra de dirección = pega cualquier URL y Enter (o ➜).
- ⟳ recargar · ↗ abrir en pestaña nueva.

## Limitaciones importantes

- **Login dentro del iframe:** aunque se quitan las cabeceras que bloquean el
  embebido, el banco sigue siendo *tercero* dentro del iframe. Por las
  restricciones de **cookies de terceros** del navegador (y protecciones
  anti-bot tipo Imperva), **el inicio de sesión puede no persistir** dentro del
  panel. Para esos casos usa **"↗ Abrir en pestaña nueva"** (ahí es primera
  parte y funciona normal).
- Las reglas de quitar cabeceras aplican solo a los dominios listados en
  `rules.json`. Si un banco redirige a otro dominio (SSO), agrégalo ahí.

## Archivos

- `manifest.json` — configuración MV3 (side panel + declarativeNetRequest).
- `rules.json` — reglas que quitan `X-Frame-Options` y `CSP` para los bancos.
- `background.js` — abre el panel lateral al clic del icono.
- `panel.html` / `panel.css` / `panel.js` — la interfaz del panel.

## Agregar más bancos

1. En `panel.js`, añade `{ name, url, color }` al arreglo `BANKS`.
2. En `rules.json`, añade el dominio a `requestDomains`.
