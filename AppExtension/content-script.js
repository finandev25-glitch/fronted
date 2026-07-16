function relayLoadVoucher(url, depositData) {
  if (!url && !depositData) return;
  chrome.runtime.sendMessage({
    type: "LOAD_VOUCHER",
    url: url || "",
    depositData: depositData || null,
    sourceUrl: window.location.href,
  });
}

// Camino PRINCIPAL: CustomEvent síncrono despachado dentro del gesto del clic.
// Como el content-script comparte el DOM con la página, este listener corre
// dentro de la misma pila del clic → conserva el "user gesture" y permite que
// el background abra el side panel sin que Chrome lo bloquee.
window.addEventListener("confirmo:load-voucher", (event) => {
  const detail = event?.detail || {};
  console.debug("confirmo:load-voucher recibido en content script:", {
    url: detail.url,
    hasDepositData: !!detail.depositData,
  });
  relayLoadVoucher(detail.url, detail.depositData);
});

// Respaldo: postMessage (asíncrono, puede perder el gesto en algunos casos).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.type !== "LOAD_VOUCHER") return;

  console.debug("LOAD_VOUCHER (postMessage) recibido en content script:", {
    url: data.url,
    hasDepositData: !!data.depositData,
  });

  relayLoadVoucher(data.url, data.depositData);
});
