// Lista de bancos de Perú. El color es solo para el botón.
const BANKS = [
  { name: "BCP", url: "https://www.viabcp.com/", color: "#ff6b00" },
  { name: "BCP TLC", url: "https://www.tlcbcp.com/", color: "#e65100" },
  { name: "BBVA", url: "https://www.bbva.pe/", color: "#1464a5" },
  { name: "Interbank", url: "https://interbank.pe/", color: "#00a94f" },
  { name: "Scotiabank", url: "https://www.scotiabank.com.pe/", color: "#e4002b" },
  { name: "BanBif", url: "https://www.banbif.com.pe/", color: "#0093d0" },
  { name: "Pichincha", url: "https://www.pichincha.pe/", color: "#f2b900" },
  { name: "B. Nación", url: "https://www.bn.com.pe/", color: "#e2001a" },
  { name: "Mibanco", url: "https://www.mibanco.com.pe/", color: "#00539b" },
];

const frame = document.getElementById("frame");
const urlInput = document.getElementById("url");
const banksEl = document.getElementById("banks");

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function load(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  urlInput.value = normalized;
  frame.src = normalized;
  // Marcar el banco activo
  document.querySelectorAll(".bank-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.url === normalized);
  });
}

// Render de los botones de bancos
BANKS.forEach((bank) => {
  const btn = document.createElement("button");
  btn.className = "bank-btn";
  btn.textContent = bank.name;
  btn.style.backgroundColor = bank.color;
  btn.dataset.url = bank.url;
  btn.title = bank.url;
  btn.addEventListener("click", () => load(bank.url));
  banksEl.appendChild(btn);
});

// Barra de dirección
document.getElementById("go").addEventListener("click", () => load(urlInput.value));
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    load(urlInput.value);
  }
});
document.getElementById("reload").addEventListener("click", () => {
  // Reasigna el src para forzar recarga
  if (frame.src) frame.src = frame.src; // eslint-disable-line no-self-assign
});
document.getElementById("newtab").addEventListener("click", () => {
  const target = normalizeUrl(urlInput.value) || BANKS[0].url;
  chrome.tabs.create({ url: target });
});

// Carga inicial: primer banco
load(BANKS[0].url);
