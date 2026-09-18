import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Filter,
  History,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DailyAttendanceSummary from "../../../../shared/ui/DailyAttendanceSummary.jsx";
import NotificationPermissionButton from "./NotificationPermissionButton.jsx";

export function KanbanToolbar({
  isCompactKanban,
  attendedUsersSummary,
  selectedValidatorFilter,
  handleValidatorFilterToggle,
  clearValidatorFilter,
  specificDate,
  setSpecificDate,
  onSelectDate,
  searchTerm,
  setSearchTerm,
  filterDateOption,
  setFilterDateOption,
  amountSearch,
  setAmountSearch,
  branchPersonSearch,
  setBranchPersonSearch,
  onFetchDepositsByDate,
  puedeTraerRezagados = false,
  viendoHoy = false,
  isPullingRezagados = false,
  onPullRezagados,
}) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const moreFiltersRef = useRef(null);
  const activeMoreFiltersCount = [amountSearch, branchPersonSearch].filter(
    (value) => value && value.trim() !== ""
  ).length;

  // Cierra el popover de "Más filtros" al hacer click fuera de él (o al
  // presionar Escape), igual que cualquier otro menú desplegable.
  useEffect(() => {
    if (!showMoreFilters) return;

    const handleClickOutside = (event) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(event.target)) {
        setShowMoreFilters(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowMoreFilters(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMoreFilters]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        {/* Nivel 1: título + acciones -- nada más compite acá. "Traer
            rezagados" vivía en su propia fila debajo del toolbar (empujaba
            las cards hacia abajo); se agrupa acá con el resto de acciones en
            vez de reclamar una fila entera solo quando aplica (finanzas/admin
            + viendo el día de hoy). */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-2xl font-bold text-gray-900 dark:text-zinc-100">
            Kanban de Depósitos
          </h2>
          <div className="flex items-center gap-2">
            {puedeTraerRezagados && viendoHoy && (
              <button
                type="button"
                onClick={onPullRezagados}
                disabled={isPullingRezagados}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50"
                title="Trae a hoy los depósitos pendientes que quedaron de días anteriores"
              >
                {isPullingRezagados ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <History size={13} />
                )}
                <span>Traer rezagados</span>
              </button>
            )}
            <NotificationPermissionButton />
          </div>
        </div>

        {/* Nivel 2: carga de trabajo por validador -- secundario a propósito,
            en su propia franja con fondo y etiqueta, para que no se lea como
            parte del título ni se confunda con qué son esos números. */}
        {!isCompactKanban && attendedUsersSummary.length > 0 && (
          <div className="hidden flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 lg:flex dark:border-slate-800 dark:bg-slate-900/40">
            <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Carga de hoy
            </span>
            {attendedUsersSummary.map((user) => (
              <button
                key={user.key}
                type="button"
                onClick={() => handleValidatorFilterToggle(user)}
                aria-pressed={selectedValidatorFilter?.key === user.key}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-sm backdrop-blur transition-all ${
                  selectedValidatorFilter?.key === user.key
                    ? "alarm-flash border-red-600 bg-red-100 text-slate-900 shadow-lg shadow-red-500/30 dark:border-red-500 dark:bg-red-200 dark:text-slate-900"
                    : "border-slate-200 bg-white/90 hover:border-red-300 hover:bg-red-50 dark:border-slate-700 dark:bg-zinc-900/90 dark:hover:border-red-700 dark:hover:bg-red-950/20"
                }`}
                title={`${user.name}: ${user.count} depósito${user.count === 1 ? "" : "s"} atendido${user.count === 1 ? "" : "s"}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                    selectedValidatorFilter?.key === user.key
                      ? "from-red-200 to-red-100 text-slate-900"
                      : "from-slate-800 to-slate-600 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
                  } text-[11px] font-bold`}
                >
                  {user.count}
                </div>
                <span className="whitespace-nowrap text-xs font-medium leading-tight text-gray-600 dark:text-zinc-300">
                  {user.name}
                </span>
              </button>
            ))}
            {selectedValidatorFilter && (
              <button
                type="button"
                onClick={clearValidatorFilter}
                className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
              >
                <span>Filtro: {selectedValidatorFilter.name}</span>
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Limpiar</span>
              </button>
            )}
          </div>
        )}

        {!isCompactKanban && attendedUsersSummary.length > 0 && (
          <div className="flex items-center gap-2 lg:hidden">
            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <DailyAttendanceSummary
                selectedDate={specificDate}
                items={attendedUsersSummary}
                compact
                showLabel={false}
                selectedKey={selectedValidatorFilter?.key}
                onItemClick={handleValidatorFilterToggle}
                className="w-max"
              />
            </div>

            {selectedValidatorFilter && (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={clearValidatorFilter}
                  className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 shadow-sm transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                  title={`Limpiar filtro: ${selectedValidatorFilter.name}`}
                  aria-label={`Limpiar filtro de ${selectedValidatorFilter.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-nowrap items-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/40 lg:hidden">
        <div className="relative w-[38%] min-w-[112px] shrink-0">
          <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
          <input
            type="date"
            value={specificDate}
            onChange={(event) => {
              const newDate = event.target.value;
              setFilterDateOption("specific");
              setSpecificDate(newDate);
              if (onSelectDate) {
                onSelectDate(newDate || null);
              }
            }}
            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="mb-6 hidden flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 lg:flex">
        {isCompactKanban ? (
          <>
            <div className="relative">
              <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                type="date"
                value={specificDate}
                onChange={(event) => {
                  const newDate = event.target.value;
                  setSpecificDate(newDate);
                  if (onSelectDate) {
                    onSelectDate(newDate || null);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
              />
            </div>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-56"
              />
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              {filterDateOption === "specific" ? (
                <>
                  <Calendar size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(event) => {
                      const newDate = event.target.value;
                      setSpecificDate(newDate);
                      if (onSelectDate) {
                        onSelectDate(newDate || null);
                      }
                      void onFetchDepositsByDate;
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDateOption("all");
                      setSpecificDate("");
                      if (onSelectDate) {
                        onSelectDate(null);
                      }
                    }}
                    title="Quitar fecha específica"
                    aria-label="Quitar fecha específica"
                    className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-zinc-300"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <Calendar size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
                  <select
                    value={filterDateOption}
                    onChange={(event) => setFilterDateOption(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
                  >
                    <option value="all">Cualquier fecha</option>
                    <option value="today">Hoy</option>
                    <option value="specific">Fecha específica</option>
                  </select>
                </>
              )}
            </div>

            <div className="relative" ref={moreFiltersRef}>
              <button
                type="button"
                onClick={() => setShowMoreFilters((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  activeMoreFiltersCount > 0
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <Filter size={14} />
                <span>Más filtros</span>
                {activeMoreFiltersCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {activeMoreFiltersCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showMoreFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-20 mt-2 w-64 space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Importe..."
                      value={amountSearch}
                      onChange={(event) => setAmountSearch(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      placeholder="Persona sucursal..."
                      value={branchPersonSearch}
                      onChange={(event) => setBranchPersonSearch(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                    {activeMoreFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmountSearch("");
                          setBranchPersonSearch("");
                        }}
                        className="w-full rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-56"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default KanbanToolbar;
