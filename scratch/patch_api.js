import fs from "fs";

// 1. Update depositsApi.js
let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

apiCode = apiCode.replace(
  `const DEPOSITS_BASE = "/v1/deposits";`,
  `const DEPOSITS_BASE = "/v1/deposits";\nconst MASTERS_BASE = "/v1/masters";`
);

apiCode = apiCode.replace(
  `export async function fetchCuentas() {
  if (MOCK_MODE_ENABLED) return getMockState().cuentas;

  console.warn("fetchCuentas: el backend no expone cuentas bancarias todavia.");
  return [];
}`,
  `export async function fetchCuentas(empresaId, bancoId) {
  if (MOCK_MODE_ENABLED) return getMockState().cuentas;

  let url = \`\${MASTERS_BASE}/cuentasbancarias\`;
  const params = new URLSearchParams();
  if (empresaId) params.append("empresaId", empresaId);
  if (bancoId) params.append("bancoId", bancoId);
  if (params.toString()) url += \`?\${params.toString()}\`;

  const data = await apiJson(url);
  return data || [];
}`
);

// Add missing functions
apiCode += `
export async function lockDeposit(id) {
  return apiJson(\`\${DEPOSITS_BASE}/\${id}/lock\`, { method: "POST" });
}

export async function unlockDeposit(id) {
  return apiJson(\`\${DEPOSITS_BASE}/\${id}/unlock\`, { method: "POST" });
}

export async function checkDuplicate(payload) {
  if (MOCK_MODE_ENABLED) return { duplicates: [] };
  return apiJson(\`\${DEPOSITS_BASE}/check-duplicate\`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
`;

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Updated depositsApi.js");
