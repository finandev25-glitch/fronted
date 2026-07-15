# Logos de empresas (Kanban)

Coloca aquí los logos de cada empresa como imágenes cuadradas (idealmente
256×256 o más). El nombre del archivo (sin extensión) se usa como clave de
coincidencia contra el nombre de la empresa en `src/utils/companyLogos.js`.

Formatos soportados: `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`.

Archivos esperados actualmente:

- `evo.png` — empresa cuyo nombre contiene "EVO"
- `jch.png` — empresa cuyo nombre contiene "JCH"

Para añadir otra empresa: suelta su logo aquí (p. ej. `acme.png`) y agrega una
regla en `COMPANY_LOGO_RULES` dentro de `src/utils/companyLogos.js`.

Los logos se muestran recortados en círculo dentro de cada card, así que el
motivo principal del logo debería estar centrado.
