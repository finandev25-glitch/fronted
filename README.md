# Sistema de Control de Depositos

Aplicacion frontend construida con React y Vite. El proyecto ya no incluye un backend Node local dentro de este repositorio.

## Requisitos

- Node.js 20 o superior
- npm
- Variables de entorno de frontend

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Produccion

```bash
npm run build
npm run preview
```

## Variables de entorno

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`
- `VITE_GOOGLE_API_KEY`
- `VITE_GOOGLE_CLIENT_ID`

`VITE_API_BASE_URL` debe apuntar a una API ya desplegada si quieres conservar funciones que usan `/api`.

## Estructura principal

- `src/` aplicacion React
- `supabase/` esquema, migraciones y edge functions relacionadas a Supabase
- `docs/` documentacion
- `sql/` scripts SQL manuales
- `archive/` snapshots manuales e historicos
