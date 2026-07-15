import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Search,
  X,
} from "lucide-react";
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
}) {
  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="whitespace-nowrap text-2xl font-bold text-gray-900 dark:text-gray-100">
              Kanban de Depósitos
            </h2>

            <NotificationPermissionButton />

            {/* Chips de usuarios atendidos, al costado derecho del título (desktop) */}
            {!isCompactKanban && attendedUsersSummary.length > 0 && (
              <div className="hidden flex-wrap items-center gap-x-2 gap-y-2 lg:flex">
                {attendedUsersSummary.map((user) => (
                  <button
                    key={user.key}
                    type="button"
                    onClick={() => handleValidatorFilterToggle(user)}
                    aria-pressed={selectedValidatorFilter?.key === user.key}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-sm backdrop-blur transition-all ${
                      selectedValidatorFilter?.key === user.key
                        ? "alarm-flash border-red-600 bg-red-100 text-slate-900 shadow-lg shadow-red-500/30 dark:border-red-500 dark:bg-red-200 dark:text-slate-900"
                        : "border-slate-200 bg-white/90 hover:border-red-300 hover:bg-red-50 dark:border-slate-700 dark:bg-gray-900/90 dark:hover:border-red-700 dark:hover:bg-red-950/20"
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
                    <span className="whitespace-nowrap text-xs font-medium leading-tight text-gray-600 dark:text-gray-300">
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
          </div>
        </div>

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

      <div className="mb-6 flex flex-nowrap items-center gap-2 overflow-hidden lg:hidden">
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
            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="mb-6 hidden flex-wrap items-center gap-4 lg:flex">
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
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
              />
            </div>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-56"
              />
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <select
                value={filterDateOption}
                onChange={(event) => setFilterDateOption(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
              >
                <option value="all">Cualquier fecha</option>
                <option value="today">Hoy</option>
                <option value="specific">Fecha específica</option>
              </select>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Importe..."
                value={amountSearch}
                onChange={(event) => setAmountSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-40"
              />
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Persona sucursal..."
                value={branchPersonSearch}
                onChange={(event) => setBranchPersonSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-56"
              />
            </div>

            <AnimatePresence>
              {filterDateOption === "specific" && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="relative"
                  transition={{ duration: 0.2 }}
                >
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-auto"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400 md:w-56"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default KanbanToolbar;
