// Carga automatica de todos los logos en src/assets/company-logos/.
// import.meta.glob es resiliente: si aun no hay archivos, devuelve {} y no
// rompe el build. Los logos aparecen en cuanto se sueltan en esa carpeta.
const modules = import.meta.glob(
  "../assets/company-logos/*.{png,jpg,jpeg,svg,webp}",
  { eager: true, import: "default" }
);

// { "evo": "/assets/evo-xxxx.png", "jch": "/assets/jch-xxxx.png", ... }
const logosByStem = Object.entries(modules).reduce((acc, [path, url]) => {
  const stem = path
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  acc[stem] = url;
  return acc;
}, {});

// Reglas de coincidencia nombre de empresa -> archivo de logo (por su "stem").
// El orden importa: se usa la primera regla que coincida.
const COMPANY_LOGO_RULES = [
  { match: /jch/i, key: "jch" },
  { match: /evo/i, key: "evo" },
];

/**
 * Devuelve la URL del logo para una empresa, o null si no hay coincidencia
 * o el archivo aun no fue agregado.
 * @param {{ nombre?: string, abreviatura?: string } | null} empresa
 * @returns {string | null}
 */
export function getCompanyLogo(empresa) {
  const label = `${empresa?.nombre || ""} ${empresa?.abreviatura || ""}`.trim();
  if (!label) return null;

  const rule = COMPANY_LOGO_RULES.find(({ match }) => match.test(label));
  if (!rule) return null;

  return logosByStem[rule.key] || null;
}

export default getCompanyLogo;
