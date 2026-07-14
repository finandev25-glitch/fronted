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
} from "lucide-react";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { getActiveDepositSignalRConnection } from "../../../services/signalrService.js";
import {
  fetchVendedores,
  fetchVendedorChatHistory,
  sendVendedorChatMessage,
  mapVendorChatMessage,
} from "../api/vendorChatApi.js";

// Roles que pueden ver este widget (finanzas/admin). Los vendedores usan la
// app movil (CONFIRMO), no este panel — pero por las dudas de que alguna vez
// un usuario con rol "vendedor" llegue a loguearse aca, el widget se oculta
// para cualquier rol que no este en esta lista.
const FINANCE_ROLES = ["admin", "finanzas"];

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

function MessageBubble({ message }) {
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

  return (
    <div className={`flex ${isFinance ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
          isFinance
            ? `bg-blue-600 text-white rounded-br-sm ${message._failed ? "opacity-60 border border-red-400" : ""}`
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            isFinance ? "text-blue-100" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {message._failed && <span className="text-red-200">no enviado</span>}
        </div>
      </div>
    </div>
  );
}

export default function VendorChatWidget({ currentUser: currentUserProp } = {}) {
  const authContext = useContext(AuthContext);
  const currentUser = currentUserProp || authContext?.currentUser || null;
  const role = currentUser?.user_rol || currentUser?.rol;
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

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const [unreadVendedorIds, setUnreadVendedorIds] = useState(() => new Set());

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

  const loadHistory = useCallback((vendedorId) => {
    if (!vendedorId) return;
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(true);
    fetchVendedorChatHistory(vendedorId, { limit: 50 })
      .then(({ messages: list, hasMore: more }) => {
        setMessages(list);
        setHasMore(!!more);
      })
      .catch((error) => {
        setMessagesError(
          error?.isChatUnavailable
            ? "El backend todavía no tiene el chat de vendedores implementado."
            : error?.message || "No se pudo cargar la conversación."
        );
      })
      .finally(() => setMessagesLoading(false));
  }, []);

  // Carga el historial al seleccionar un vendedor.
  useEffect(() => {
    if (!selectedVendedor?.id) return;
    loadHistory(selectedVendedor.id);
  }, [selectedVendedor, loadHistory]);

  // Auto-scroll al ultimo mensaje.
  useEffect(() => {
    if (view === "conversation") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, view]);

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

  const filteredVendedores = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vendedores;
    return vendedores.filter((vendedor) => {
      return (
        vendedor.nombre?.toLowerCase().includes(term) ||
        vendedor.telefono?.toLowerCase().includes(term) ||
        vendedor.email?.toLowerCase().includes(term)
      );
    });
  }, [vendedores, search]);

  const openVendedor = (vendedor) => {
    setSelectedVendedor(vendedor);
    setView("conversation");
    setSendError(null);
    setDraft("");
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
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !selectedVendedor?.id || sending) return;

    setSending(true);
    setSendError(null);

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
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-blue-600">
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
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-semibold text-sm">
                            {getInitials(vendedor.nombre)}
                          </div>
                          {isUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-900" />
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
              <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 bg-blue-600">
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

              <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-950">
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

                {!messagesLoading && !messagesError && hasMore && (
                  <div className="flex justify-center mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Hay mensajes anteriores no cargados
                    </span>
                  </div>
                )}

                {!messagesLoading && !messagesError && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <MessageSquare size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Todavía no hay mensajes con este vendedor.
                    </p>
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 p-2">
                {sendError && (
                  <p className="text-xs text-red-500 mb-1.5 px-1">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="flex-1 resize-none max-h-24 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="flex-shrink-0 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
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
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white p-4 flex items-center justify-center transition-colors"
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
