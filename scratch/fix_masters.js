import fs from "fs";

let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

apiCode = apiCode.replace(
  "const data = await apiJson(`${DEPOSITS_BASE}/bancos`);",
  "const data = await apiJson(`${MASTERS_BASE}/bancos`);"
);

apiCode = apiCode.replace(
  "const data = await apiJson(`${DEPOSITS_BASE}/empresas`);",
  "const data = await apiJson(`${MASTERS_BASE}/empresas`);"
);

// also fix fetchSucursales and fetchPersonal if they exist
apiCode = apiCode.replace(
  "const data = await apiJson(`${DEPOSITS_BASE}/sucursales`);",
  "const data = await apiJson(`${MASTERS_BASE}/sucursales`);"
);

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Fixed MASTERS_BASE endpoints.");
