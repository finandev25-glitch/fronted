import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  X,
  ArrowLeft,
  Send,
  Loader2,
  User,
  Search,
  AlertCircle,
  RefreshCw,
  CheckCheck,
  Receipt,
  ExternalLink,
  Reply,
} from "lucide-react";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { getActiveDepositSignalRConnection } from "../../../services/signalrService.js";
import {
  fetchVendedores,
  fetchVendedorChatHistory,
  sendVendedorChatMessage,
  mapVendorChatMessage,
} from "../api/vendorChatApi.js";
import { fetchDepositsByVendedor } from "../../deposits/api/depositsApi.js";

// Ventana de días visible al abrir una conversación (mensajes + vouchers).
// Mostrar todo el historial de golpe sobrecargaba el widget, así que se
// arranca con los últimos DIAS_INICIALES y el botón "Cargar más" va
// sumando de a un día (DIAS_POR_CLICK) hasta DIAS_MAXIMOS.
const DIAS_INICIALES = 2;
const DIAS_POR_CLICK = 1;
const DIAS_MAXIMOS = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
// Tope de páginas de 50 mensajes que se piden en una sola carga, para que
// un vendedor con muchísimo chat no dispare decenas de requests seguidos.
const MAX_PAGINAS_HISTORIAL = 20;

// Roles que pueden ver este widget (finanzas/admin). Los vendedores usan la
// app movil (CONFIRMO), no este panel — pero por las dudas de que alguna vez
// un usuario con rol "vendedor" llegue a loguearse aca, el widget se oculta
// para cualquier rol que no este en esta lista.
const FINANCE_ROLES = ["admin", "finanzas"];

// Paleta calcada de WhatsApp (pedido explícito: "quiero una vista como la
// imagen adjunta" -- maqueta de un chat de WhatsApp real). Se define acá
// como constantes de clases Tailwind porque son los únicos lugares del
// proyecto que necesitan estos tonos exactos. El fondo con puntitos del
// área de mensajes ("wa-chat-wallpaper") va en index.css, no acá -- ver
// comentario ahí.
const WA_HEADER_BG = "bg-[#075E54]";
const WA_OUTGOING_BUBBLE = "bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-900 dark:text-gray-50";
const WA_CHECK_COLOR = "text-[#34b7f1]";

function getInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatMonto(monto, moneda) {
  if (monto === null || monto === undefined) return "";
  const symbol = moneda === "USD" ? "US$" : "S/";
  const value = Number(monto);
  if (Number.isNaN(value)) return "";
  return `${symbol} ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mismos colores que se usan en el resto del Kanban para el estado del
// depósito (ver DepositCard.jsx) -- se repiten acá en vez de importarlos
// para no acoplar este widget a ese componente.
const ESTADO_BADGE_CLASS = {
  recibido: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  procesado: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  confirmado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// Convierte cada depósito (voucher) en un item de timeline con la misma
// forma minima que un mensaje de chat ({ id, kind, timestamp }), para poder
// mezclarlo y ordenarlo junto con los mensajes de texto en un solo array.
function buildVoucherTimelineItem(deposit) {
  const timestamp = deposit.fecha_registro_original || deposit.fecha_registro;
  return {
    kind: "voucher",
    id: `voucher-${deposit.id}`,
    timestamp,
    deposit,
  };
}

// ---------------------------------------------------------------------------
// Responder a un mensaje (estilo WhatsApp). El backend no tiene un campo
// "reply_to" en VendedorMessage (solo Content + MessageType), así que la cita
// viaja DENTRO del texto con un formato legible:
//
//   > Autor: texto citado
//   respuesta real
//
// Este widget lo detecta y lo dibuja como tarjeta de cita; cualquier otro
// cliente (p. ej. la app móvil) lo ve como texto plano con la línea citada
// arriba, que sigue siendo entendible. Si algún día el backend suma un campo
// de respuesta, solo hay que cambiar estas dos funciones.
// ---------------------------------------------------------------------------
const QUOTE_REGEX = /^> ([^:\n]{1,40}): ([^\n]*)\n([\s\S]*)$/;
const QUOTE_MAX_CHARS = 80;

function buildQuotedContent(quote, body) {
  if (!quote) return body;
  const snippet = String(quote.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, QUOTE_MAX_CHARS);
  const author = String(quote.author || "").replace(/[:\n]/g, " ").trim().slice(0, 40) || "Mensaje";
  return `> ${author}: ${snippet}\n${body}`;
}

function parseQuotedContent(content) {
  const match = QUOTE_REGEX.exec(String(content || ""));
  if (!match) return { quote: null, body: content };
  return { quote: { author: match[1], text: match[2] }, body: match[3] };
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Vendedor";
}

function QuoteBlock({ quote, outgoing }) {
  return (
    <div
      className={`mb-1 rounded-md border-l-4 px-2 py-1 text-xs ${
        outgoing
          ? "border-[#075E54] bg-black/5 dark:bg-white/10"
          : "border-[#34b7f1] bg-gray-100 dark:bg-gray-700/60"
      }`}
    >
      <p className="font-semibold text-[#075E54] dark:text-emerald-300">{quote.author}</p>
      <p className="line-clamp-2 text-gray-600 dark:text-gray-300">{quote.text}</p>
    </div>
  );
}

function ReplyButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Responder"
      aria-label="Responder"
      className="self-center opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 rounded-full p-1 text-gray-500 hover:bg-black/10 dark:text-gray-400 dark:hover:bg-white/10"
    >
      <Reply size={14} />
    </button>
  );
}

function formatFechaDeposito(fechaDeposito) {
  if (!fechaDeposito) return null;
  try {
    // fecha_deposito es un DateOnly ("YYYY-MM-DD"), sin hora ni offset -- se
    // arma la fecha con los componentes sueltos para no correr riesgo de que
    // el navegador la interprete como medianoche UTC y la corra un día.
    const [year, month, day] = fechaDeposito.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

// Burbuja de voucher con forma de "recibo" (pedido explícito: que se vea
// como la nota/ticket de la maqueta de WhatsApp, no solo una miniatura
// suelta). Mantiene la miniatura arriba -- finanzas sigue necesitando ver
// la imagen real del comprobante -- pero agrega el detalle del depósito en
// un bloque tipo ticket (fuente monoespaciada, separadores punteados).
function VoucherBubble({ deposit, onReply }) {
  const badgeClass =
    ESTADO_BADGE_CLASS[deposit.estado] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const fechaVoucher = formatFechaDeposito(deposit.fecha_deposito);

  return (
    <div className="group flex justify-start mb-2 gap-1">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        {deposit.imagen_voucher && (
          <a
            href={deposit.imagen_voucher}
            target="_blank"
            rel="noreferrer"
            title="Ver voucher completo"
            className="block"
          >
            <img
              src={deposit.imagen_voucher}
              alt="Voucher"
              className="w-full max-h-40 object-cover bg-gray-100 dark:bg-gray-800"
              loading="lazy"
            />
          </a>
        )}

        <div className="px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-800 dark:text-gray-200">
          <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-dashed border-gray-300 dark:border-gray-700">
            <Receipt size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <span className="font-semibold tracking-wide">COMPROBANTE DE DEPÓSITO</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 dark:text-gray-400">Monto</span>
              <span className="font-semibold">{formatMonto(deposit.monto, deposit.moneda)}</span>
            </div>
            {deposit.numero_operacion && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400">Operación</span>
                <span className="truncate">{deposit.numero_operacion}</span>
              </div>
            )}
            {deposit.banco?.nombre && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400">Banco</span>
                <span className="truncate">{deposit.banco.nombre}</span>
              </div>
            )}
            {deposit.cliente && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400">Cliente</span>
                <span className="truncate">{deposit.cliente}</span>
              </div>
            )}
            {fechaVoucher && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400">Fecha voucher</span>
                <span>{fechaVoucher}</span>
              </div>
            )}
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-between gap-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full font-sans ${badgeClass}`}>
              {deposit.estado}
            </span>
            {deposit.imagen_voucher && (
              <a
                href={deposit.imagen_voucher}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] font-sans text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ver completo <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>

        <div className="px-3 pb-1.5 text-right text-[10px] text-gray-400 dark:text-gray-500">
          {formatTime(deposit.fecha_registro_original || deposit.fecha_registro)}
        </div>
      </div>
      {onReply && (
        <ReplyButton
          onClick={() =>
            onReply({
              author: "Comprobante",
              text: [formatMonto(deposit.monto, deposit.moneda), deposit.numero_operacion && `Op. ${deposit.numero_operacion}`]
                .filter(Boolean)
                .join(" · "),
            })
          }
        />
      )}
    </div>
  );
}

function MessageBubble({ message, vendedorNombre, onReply }) {
  if (message.senderType === "system") {
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs italic text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isFinance = message.senderType === "finance";
  const { quote, body } = parseQuotedContent(message.content);

  const replyButton = onReply && (
    <ReplyButton
      onClick={() =>
        onReply({
          author: isFinance ? "Finanzas" : firstName(vendedorNombre),
          // Si este mensaje a su vez era una respuesta, se cita solo su texto
          // propio (no la cita anidada) -- igual que WhatsApp.
          text: body,
        })
      }
    />
  );

  return (
    <div className={`group flex ${isFinance ? "justify-end" : "justify-start"} mb-2 gap-1`}>
      {isFinance && replyButton}
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words shadow-sm ${
          isFinance
            ? `${WA_OUTGOING_BUBBLE} rounded-br-sm ${message._failed ? "opacity-60 border border-red-400" : ""}`
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        {quote && <QuoteBlock quote={quote} outgoing={isFinance} />}
        <p className="whitespace-pre-wrap">{body}</p>
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isFinance ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {/* Check doble estilo WhatsApp: puramente estético, no hay
              tracking real de "leído" -- solo indica que el mensaje ya
              está persistido (no es el optimista con id temporal). */}
          {isFinance && !message._failed && !String(message.id).startsWith("local-") && (
            <CheckCheck size={13} className={WA_CHECK_COLOR} />
          )}
          {message._failed && <span className="text-red-500 dark:text-red-300">no enviado</span>}
        </div>
      </div>
      {!isFinance && replyButton}
    </div>
  );
}

export default function VendorChatWidget({ currentUser: currentUserProp } = {}) {
  const authContext = useContext(AuthContext);
  const currentUser = currentUserProp || authContext?.currentUser || null;
  const role = currentUser?.user_rol;
  const canUseChat = !!currentUser && FINANCE_ROLES.includes(role);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("list"); // "list" | "conversation"

  const [vendedores, setVendedores] = useState([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [vendedoresError, setVendedoresError] = useState(null);
  const [vendedoresLoaded, setVendedoresLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedVendedor, setSelectedVendedor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Vouchers (depósitos con imagen) del vendedor seleccionado, para
  // intercalarlos en la conversación como contexto de a qué depósito se
  // refiere cada mensaje. Se cargan aparte de los mensajes -- un error acá
  // no debe bloquear el chat de texto, por eso su propio loading/error.
  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [vouchersError, setVouchersError] = useState(null);

  // Días hacia atrás que se muestran hoy (ver DIAS_INICIALES arriba) y estado
  // del botón "Cargar más".
  const [diasVisibles, setDiasVisibles] = useState(DIAS_INICIALES);
  const [loadingMore, setLoadingMore] = useState(false);
  // Id del último item del timeline: el auto-scroll al fondo solo debe
  // dispararse cuando cambia (mensaje/voucher nuevo), no cuando se cargan
  // items VIEJOS arriba -- si no, "Cargar más" te tiraría al final.
  const lastTimelineIdRef = useRef(null);

  const [draft, setDraft] = useState("");
  // Mensaje/voucher al que se está respondiendo ({ author, text }) o null.
  const [replyingTo, setReplyingTo] = useState(null);
  const draftInputRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const [unreadVendedorIds, setUnreadVendedorIds] = useState(() => new Set());
  // Timestamp (ms) del ultimo mensaje visto por vendedor, usado para ordenar
  // la lista con el mas reciente arriba (ver sortedVendedores mas abajo).
  const [vendedorActivity, setVendedorActivity] = useState({});
  // Solicitud pendiente de abrir el chat de un trabajador (desde el evento
  // global "confirmo:open-vendor-chat", p. ej. desde el modal de detalle).
  const [pendingVendorMatch, setPendingVendorMatch] = useState(null);

  const messagesEndRef = useRef(null);
  const selectedVendedorIdRef = useRef(null);

  useEffect(() => {
    selectedVendedorIdRef.current = selectedVendedor?.id ? String(selectedVendedor.id) : null;
  }, [selectedVendedor]);

  const loadVendedores = useCallback(() => {
    if (!canUseChat) return;
    setVendedoresLoading(true);
    setVendedoresError(null);
    fetchVendedores()
      .then((list) => {
        setVendedores(list);
        setVendedoresLoaded(true);
      })
      .catch((error) => {
        setVendedoresError(error?.message || "No se pudo cargar la lista de vendedores.");
      })
      .finally(() => setVendedoresLoading(false));
  }, [canUseChat]);

  // Carga la lista de vendedores la primera vez que se abre el panel.
  useEffect(() => {
    if (!isOpen || vendedoresLoaded || !canUseChat) return;
    loadVendedores();
  }, [isOpen, vendedoresLoaded, canUseChat, loadVendedores]);

  // Permite abrir el chat de un trabajador desde otras partes de la app:
  //   window.dispatchEvent(new CustomEvent("confirmo:open-vendor-chat",
  //     { detail: { id, nombre, telefono } }))
  useEffect(() => {
    const handler = (event) => {
      if (!canUseChat) return;
      setIsOpen(true);
      setPendingVendorMatch(event.detail || {});
    };
    window.addEventListener("confirmo:open-vendor-chat", handler);
    return () => window.removeEventListener("confirmo:open-vendor-chat", handler);
  }, [canUseChat]);

  // Cuando los vendedores estén cargados y haya una solicitud pendiente, abre
  // la conversación del que coincida (por teléfono, luego id, luego nombre).
  useEffect(() => {
    if (!pendingVendorMatch || !vendedoresLoaded || vendedores.length === 0) return;

    const normPhone = (value) => String(value || "").replace(/\D/g, "").replace(/^51/, "");
    const wantPhone = normPhone(pendingVendorMatch.telefono);
    const wantName = String(pendingVendorMatch.nombre || "").trim().toLowerCase();
    const wantId = pendingVendorMatch.id != null ? String(pendingVendorMatch.id) : null;

    const match =
      (wantId && vendedores.find((v) => String(v.id) === wantId)) ||
      (wantPhone && vendedores.find((v) => normPhone(v.telefono) === wantPhone)) ||
      (wantName &&
        vendedores.find(
          (v) => String(v.nombre || "").trim().toLowerCase() === wantName,
        )) ||
      null;

    if (match) {
      openVendedor(match);
    } else if (pendingVendorMatch.nombre || pendingVendorMatch.telefono) {
      // No se encontró exacto: deja el término en el buscador para ubicarlo.
      setSearch(pendingVendorMatch.nombre || pendingVendorMatch.telefono || "");
      setView("list");
    }
    setPendingVendorMatch(null);
  }, [pendingVendorMatch, vendedoresLoaded, vendedores]);

  // Pide páginas de 50 mensajes (cursor `before`, el backend devuelve los más
  // recientes primero y los reordena ascendente) y las va ANTEPONIENDO a
  // `seed` hasta que el mensaje más viejo cargado llegue al cutoff o no
  // queden más. El backend pagina por cantidad, no por días, así que la
  // ventana de días se arma acá.
  const fetchMessagesUntil = useCallback(async (vendedorId, cutoffMs, seed = [], seedHasMore = true) => {
    let acc = seed;
    let more = seedHasMore;
    let pages = 0;
    while (more && pages < MAX_PAGINAS_HISTORIAL) {
      const oldest = acc[0];
      if (oldest && new Date(oldest.createdAt).getTime() <= cutoffMs) break;
      const { messages: page, hasMore: pageMore } = await fetchVendedorChatHistory(vendedorId, {
        limit: 50,
        before: oldest?.createdAt,
      });
      pages += 1;
      more = !!pageMore;
      if (page.length === 0) break;
      acc = [...page, ...acc];
    }
    return { list: acc, hasMore: more };
  }, []);

  const loadHistory = useCallback((vendedorId) => {
    if (!vendedorId) return;
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(true);
    fetchMessagesUntil(vendedorId, Date.now() - DIAS_INICIALES * MS_POR_DIA)
      .then(({ list, hasMore: more }) => {
        setMessages(list);
        setHasMore(more);
      })
      .catch((error) => {
        setMessagesError(
          error?.isChatUnavailable
            ? "El backend todavía no tiene el chat de vendedores implementado."
            : error?.message || "No se pudo cargar la conversación."
        );
      })
      .finally(() => setMessagesLoading(false));
  }, [fetchMessagesUntil]);

  // Carga el historial al seleccionar un vendedor.
  useEffect(() => {
    if (!selectedVendedor?.id) return;
    loadHistory(selectedVendedor.id);
  }, [selectedVendedor, loadHistory]);

  // No limpia `vouchers` al arrancar: se vuelve a llamar cada vez que se
  // amplía la ventana de días y vaciar la lista haría parpadear la
  // conversación. La limpieza al cambiar de vendedor está en
  // openVendedor/goBack.
  const loadVouchers = useCallback((vendedorId, dias) => {
    if (!vendedorId) return;
    setVouchersError(null);
    setVouchersLoading(true);
    fetchDepositsByVendedor(vendedorId, { diasAtras: dias })
      .then((deposits) => {
        // Salvaguarda client-side (ver comentario en fetchDepositsByVendedor):
        // si el backend todavía no filtra por vendedorId, acá se descarta
        // cualquier depósito que no sea realmente de este vendedor. Si
        // vendedor_id viniera null (backend viejo, sin VendedorId en el
        // listado) se prefiere no mostrar nada a mostrar vouchers de otro
        // vendedor por error.
        const vendedorIdStr = String(vendedorId).toLowerCase();
        const propios = (deposits || []).filter((d) => d.vendedor_id === vendedorIdStr);
        setVouchers(propios);
      })
      .catch((error) => {
        setVouchersError(error?.message || "No se pudieron cargar los vouchers de este vendedor.");
      })
      .finally(() => setVouchersLoading(false));
  }, []);

  // Carga los vouchers al seleccionar un vendedor (en paralelo al historial
  // de texto de arriba) y de nuevo cada vez que se amplía la ventana.
  useEffect(() => {
    if (!selectedVendedor?.id) return;
    loadVouchers(selectedVendedor.id, diasVisibles);
  }, [selectedVendedor, diasVisibles, loadVouchers]);

  // Timeline unificado: mensajes de texto + vouchers, ordenados por fecha.
  // Es la pieza clave del pedido original ("simular la interfaz del
  // aplicativo móvil", donde se ven las imágenes intercaladas con el texto).
  // Solo entra lo que cae dentro de la ventana de `diasVisibles` días; lo
  // más viejo ya cargado queda guardado en `messages` y aparece al ampliar.
  const cutoffMs = useMemo(
    () => Date.now() - diasVisibles * MS_POR_DIA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diasVisibles, selectedVendedor]
  );

  const { timeline, hayMensajesOcultos } = useMemo(() => {
    const dentroDeVentana = (iso) => {
      const ts = iso ? new Date(iso).getTime() : 0;
      return ts >= cutoffMs;
    };
    const messageItems = messages
      .filter((message) => dentroDeVentana(message.createdAt))
      .map((message) => ({
        kind: "message",
        id: `message-${message.id}`,
        timestamp: message.createdAt,
        message,
      }));
    const voucherItems = vouchers
      .filter((deposit) =>
        dentroDeVentana(deposit.fecha_registro_original || deposit.fecha_registro)
      )
      .map(buildVoucherTimelineItem);
    const items = [...messageItems, ...voucherItems].sort((a, b) => {
      const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tsA - tsB;
    });
    return {
      timeline: items,
      hayMensajesOcultos: messageItems.length < messages.length,
    };
  }, [messages, vouchers, cutoffMs]);

  // "Cargar más" se ofrece mientras haya algo más que traer: mensajes
  // viejos ya cargados pero ocultos, mensajes sin traer todavía (hasMore) o
  // aún no se llegó al máximo de días de vouchers.
  const puedeCargarMas = hayMensajesOcultos || hasMore || diasVisibles < DIAS_MAXIMOS;

  const handleCargarMas = async () => {
    if (!selectedVendedor?.id || loadingMore) return;
    const nuevosDias = Math.min(diasVisibles + DIAS_POR_CLICK, DIAS_MAXIMOS);
    setDiasVisibles(nuevosDias);
    if (!hasMore) return;

    setLoadingMore(true);
    try {
      const { list, hasMore: more } = await fetchMessagesUntil(
        selectedVendedor.id,
        Date.now() - nuevosDias * MS_POR_DIA,
        messages,
        hasMore
      );
      setMessages(list);
      setHasMore(more);
    } catch (error) {
      setMessagesError(error?.message || "No se pudieron cargar más mensajes.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Auto-scroll al ultimo mensaje (o voucher) solo cuando cambia el ÚLTIMO
  // item del timeline. Al cargar items viejos arriba ("Cargar más") el último
  // no cambia, así que no te manda al fondo.
  useEffect(() => {
    if (view !== "conversation") return;
    const lastId = timeline.length ? timeline[timeline.length - 1].id : null;
    if (lastId === lastTimelineIdRef.current) return;
    lastTimelineIdRef.current = lastId;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline, view]);

  // Listener de SignalR para el evento "ChatMessage". La conexion activa y
  // compartida (getActiveDepositSignalRConnection) se arranca de forma
  // asincronica en otro lado de la app (useRealtimeDeposits), asi que puede
  // no existir todavia cuando este widget se monta — se reintenta engancharse
  // con un intervalo corto hasta encontrarla, y se limpia al desmontar.
  useEffect(() => {
    if (!canUseChat) return undefined;

    let cancelled = false;
    let attachedConnection = null;

    const handler = (payload) => {
      const rawMessage = payload?.message || null;
      if (!rawMessage) return;

      const vendedorId = payload?.vendedorId || rawMessage?.vendedorId || null;
      if (!vendedorId) return; // Evento de otro tipo de chat (ej. depositos), se ignora aca.

      const mapped = mapVendorChatMessage(rawMessage, vendedorId);
      const vendedorIdStr = String(vendedorId);

      // Cualquier mensaje nuevo (entrante o saliente via eco) sube a este
      // vendedor al tope de la lista, sin importar si su conversacion esta
      // abierta o no.
      const activityTs = mapped.createdAt ? new Date(mapped.createdAt).getTime() : Date.now();
      setVendedorActivity((prev) => {
        if ((prev[vendedorIdStr] || 0) >= activityTs) return prev;
        return { ...prev, [vendedorIdStr]: activityTs };
      });

      if (vendedorIdStr === selectedVendedorIdRef.current) {
        setMessages((prev) => {
          if (mapped.id && prev.some((item) => String(item.id) === String(mapped.id))) return prev;
          // Si este eco corresponde a un mensaje que este mismo panel acaba de
          // mandar, puede llegar ANTES de que resuelva el POST (la notificacion
          // de SignalR se dispara antes de que el endpoint devuelva la
          // respuesta, ver ChatService.AddVendedorMessageAsync). En ese caso el
          // mensaje optimista todavia tiene el id temporal "local-...", asi que
          // el chequeo de arriba no lo detecta como duplicado. Se reconcilia
          // aca en vez de agregar una entrada nueva; cuando el POST resuelva,
          // el .map de handleSend ya no va a encontrar el id temporal y no va
          // a hacer nada (sin duplicar).
          const pendingMatch = prev.find(
            (item) => String(item.id).startsWith("local-") && item.content === mapped.content
          );
          if (pendingMatch) {
            return prev.map((item) => (item === pendingMatch ? { ...mapped } : item));
          }
          return [...prev, mapped];
        });
      } else {
        // Nice-to-have: marcar como no leido al vendedor que no esta abierto.
        setUnreadVendedorIds((prev) => {
          if (prev.has(vendedorIdStr)) return prev;
          const next = new Set(prev);
          next.add(vendedorIdStr);
          return next;
        });
      }
    };

    const tryAttach = () => {
      if (cancelled) return;
      const connection = getActiveDepositSignalRConnection();
      if (connection && connection !== attachedConnection) {
        connection.on("ChatMessage", handler);
        attachedConnection = connection;
      }
    };

    tryAttach();
    const intervalId = setInterval(tryAttach, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      attachedConnection?.off("ChatMessage", handler);
    };
  }, [canUseChat]);

  // Vendedores ordenados con el mensaje mas reciente arriba. Los que no
  // tienen actividad registrada todavia (timestamp 0) mantienen su orden
  // original (el que devuelve la API), gracias a que Array.sort es estable.
  const sortedVendedores = useMemo(() => {
    if (!vendedores.length) return vendedores;
    const hasActivity = Object.keys(vendedorActivity).length > 0;
    if (!hasActivity) return vendedores;
    return [...vendedores].sort((a, b) => {
      const tsA = vendedorActivity[String(a.id)] || 0;
      const tsB = vendedorActivity[String(b.id)] || 0;
      return tsB - tsA;
    });
  }, [vendedores, vendedorActivity]);

  const filteredVendedores = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedVendedores;
    return sortedVendedores.filter((vendedor) => {
      return (
        vendedor.nombre?.toLowerCase().includes(term) ||
        vendedor.telefono?.toLowerCase().includes(term) ||
        vendedor.email?.toLowerCase().includes(term)
      );
    });
  }, [sortedVendedores, search]);

  const openVendedor = (vendedor) => {
    setSelectedVendedor(vendedor);
    setView("conversation");
    setSendError(null);
    setDraft("");
    // Cada conversación arranca de nuevo con la ventana corta y sin restos
    // de la anterior.
    setDiasVisibles(DIAS_INICIALES);
    setVouchers([]);
    setHasMore(false);
    setReplyingTo(null);
    lastTimelineIdRef.current = null;
    setUnreadVendedorIds((prev) => {
      if (!prev.has(String(vendedor.id))) return prev;
      const next = new Set(prev);
      next.delete(String(vendedor.id));
      return next;
    });
  };

  const goBack = () => {
    setView("list");
    setSelectedVendedor(null);
    setMessages([]);
    setMessagesError(null);
    setSendError(null);
    setVouchers([]);
    setVouchersError(null);
    setDiasVisibles(DIAS_INICIALES);
    setHasMore(false);
    setReplyingTo(null);
    lastTimelineIdRef.current = null;
  };

  const handleReply = (quote) => {
    setReplyingTo(quote);
    draftInputRef.current?.focus();
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedVendedor?.id || sending) return;
    // Si se está respondiendo a algo, la cita se antepone al texto (ver
    // buildQuotedContent). Ese string completo es lo que se manda y se
    // guarda, así que el eco de SignalR coincide con el optimista.
    const content = buildQuotedContent(replyingTo, body);

    setSending(true);
    setSendError(null);
    setReplyingTo(null);

    const optimisticId = `local-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      vendedorId: selectedVendedor.id,
      senderType: "finance",
      senderId: currentUser?.id || null,
      content,
      messageType: "text",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");
    setVendedorActivity((prev) => ({ ...prev, [String(selectedVendedor.id)]: Date.now() }));

    try {
      // sendVendedorChatMessage devuelve el mensaje YA persistido (con el id
      // real del backend). Reemplazamos el mensaje optimista por ese. Si el
      // eco de SignalR llega ANTES que esta respuesta (race real, ver el
      // listener arriba), el eco ya reconcilia el mensaje optimista por
      // contenido y este .map simplemente no encuentra el id temporal y no
      // hace nada — no se duplica en ningun orden de llegada. Mismo criterio
      // que se uso para el chat de CONFIRMO.
      const persisted = await sendVendedorChatMessage(selectedVendedor.id, { content });
      if (persisted?.id) {
        setMessages((prev) =>
          prev.map((item) => (item.id === optimisticId ? { ...persisted } : item))
        );
      }
    } catch (error) {
      setSendError(
        error?.isChatUnavailable
          ? "El backend todavía no tiene el chat de vendedores implementado. El mensaje no se pudo enviar."
          : error?.message || "No se pudo enviar el mensaje."
      );
      setMessages((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, _failed: true } : item))
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const totalUnread = unreadVendedorIds.size;

  if (!canUseChat) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[30rem] max-h-[70vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
          {view === "list" ? (
            <>
              <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${WA_HEADER_BG}`}>
                <h3 className="text-sm font-semibold text-white">Chat con vendedores</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white"
                  aria-label="Cerrar chat"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar vendedor..."
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#075E54]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {vendedoresLoading && (
                  <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    <span className="text-sm">Cargando vendedores...</span>
                  </div>
                )}

                {!vendedoresLoading && vendedoresError && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <AlertCircle size={22} className="text-amber-500 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{vendedoresError}</p>
                    <button
                      type="button"
                      onClick={loadVendedores}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <RefreshCw size={12} /> Reintentar
                    </button>
                  </div>
                )}

                {!vendedoresLoading && !vendedoresError && filteredVendedores.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <User size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {vendedores.length === 0
                        ? "No hay vendedores activos."
                        : "Ningun vendedor coincide con la busqueda."}
                    </p>
                  </div>
                )}

                {!vendedoresLoading &&
                  !vendedoresError &&
                  filteredVendedores.map((vendedor) => {
                    const isUnread = unreadVendedorIds.has(String(vendedor.id));
                    return (
                      <button
                        key={vendedor.id}
                        type="button"
                        onClick={() => openVendedor(vendedor)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-[#075E54]/10 dark:bg-[#075E54]/40 text-[#075E54] dark:text-emerald-300 flex items-center justify-center font-semibold text-sm">
                            {getInitials(vendedor.nombre)}
                          </div>
                          {isUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-white dark:border-gray-900" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {vendedor.nombre}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {vendedor.telefono || vendedor.email || "Sin contacto"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </>
          ) : (
            <>
              <div className={`flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 ${WA_HEADER_BG}`}>
                <button
                  type="button"
                  onClick={goBack}
                  className="text-white/90 hover:text-white flex-shrink-0"
                  aria-label="Volver a la lista"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                  {getInitials(selectedVendedor?.nombre)}
                </div>
                <h3 className="text-sm font-semibold text-white truncate flex-1">
                  {selectedVendedor?.nombre || "Vendedor"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white flex-shrink-0"
                  aria-label="Cerrar chat"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 wa-chat-wallpaper">
                {messagesLoading && (
                  <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    <span className="text-sm">Cargando conversación...</span>
                  </div>
                )}

                {!messagesLoading && messagesError && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <AlertCircle size={22} className="text-amber-500 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{messagesError}</p>
                    <button
                      type="button"
                      onClick={() => loadHistory(selectedVendedor?.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <RefreshCw size={12} /> Reintentar
                    </button>
                  </div>
                )}

                {!messagesLoading && !messagesError && puedeCargarMas && (
                  <div className="flex flex-col items-center gap-1 mb-3">
                    <button
                      type="button"
                      onClick={handleCargarMas}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-[#075E54] dark:text-emerald-300 shadow-sm hover:bg-white disabled:opacity-60"
                    >
                      {loadingMore && <Loader2 size={12} className="animate-spin" />}
                      Cargar más (+{DIAS_POR_CLICK} día)
                    </button>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      Mostrando los últimos {diasVisibles} días
                    </span>
                  </div>
                )}

                {vouchersError && (
                  <div className="flex justify-center mb-2">
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {vouchersError}
                    </span>
                  </div>
                )}

                {!messagesLoading && !messagesError && !vouchersLoading && timeline.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <MessageSquare size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {puedeCargarMas
                        ? `No hay mensajes ni vouchers en los últimos ${diasVisibles} días.`
                        : "Todavía no hay mensajes ni vouchers de este vendedor."}
                    </p>
                  </div>
                )}

                {timeline.map((item) =>
                  item.kind === "voucher" ? (
                    <VoucherBubble key={item.id} deposit={item.deposit} onReply={handleReply} />
                  ) : (
                    <MessageBubble
                      key={item.id}
                      message={item.message}
                      vendedorNombre={selectedVendedor?.nombre}
                      onReply={handleReply}
                    />
                  )
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 p-2">
                {sendError && (
                  <p className="text-xs text-red-500 mb-1.5 px-1">{sendError}</p>
                )}
                {replyingTo && (
                  <div className="mb-1.5 flex items-start gap-2 rounded-lg border-l-4 border-[#34b7f1] bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#075E54] dark:text-emerald-300">
                        Respondiendo a {replyingTo.author}
                      </p>
                      <p className="truncate text-gray-600 dark:text-gray-300">{replyingTo.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      aria-label="Cancelar respuesta"
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={draftInputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="flex-1 resize-none max-h-24 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#075E54]"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="flex-shrink-0 p-2.5 rounded-lg bg-[#075E54] hover:bg-[#064c44] disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    aria-label="Enviar mensaje"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 flex items-center justify-center transition-colors"
        aria-label={isOpen ? "Cerrar chat de vendedores" : "Abrir chat de vendedores"}
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-950">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
    </>
  );
}
