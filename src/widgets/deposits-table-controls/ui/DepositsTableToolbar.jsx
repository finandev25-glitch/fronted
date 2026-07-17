import React from "react";
import { Calendar, Download, Filter, Search, XCircle, Archive } from "lucide-react";

export default function DepositsTableToolbar({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterPeriod,
  setFilterPeriod,
  selectedMonth,
  setSelectedMonth,
  specificDate,
  setSpecificDate,
  onFetchDepositsByDate,
  onFetchDepositsByPeriod,
  onSelectedDateChange,
  onSelectDate,
  onExportExcel,
  canExportVouchers = false,
  onOpenExportVouchers,
}) {
  return (
    <div className="mb-6 flex shrink-0 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Listado de Depósitos
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Busca y filtra todos los depósitos registrados.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onExportExcel}
            className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <Download size={14} />
            <span>Exportar Excel</span>
          </button>
          {canExportVouchers && (
            <button
              onClick={onOpenExportVouchers}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Archive size={14} />
              <span>Respaldo de vouchers</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col space-y-3 md:flex-row md:space-x-4 md:space-y-0">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar en todas las columnas..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
          >
            <option value="all">Todos los estados</option>
            <option value="recibido">Pendiente</option>
            <option value="en_validacion">En Validación</option>
            <option value="validado">Validado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar size={14} className="text-gray-400" />
          <select
            value={filterPeriod}
            onChange={(event) => setFilterPeriod(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
          >
            <option value="all">Todo el tiempo</option>
            <option value="today">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Seleccionar Mes</option>
          </select>
        </div>

        {filterPeriod === "month" && (
          <div className="flex items-center space-x-2">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
            />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            value={specificDate}
            onChange={(event) => {
              const newDate = event.target.value;
              setSpecificDate(newDate);

              if (onSelectDate) {
                onSelectDate(newDate || null);
              } else {
                if (newDate && onFetchDepositsByDate) {
                  onFetchDepositsByDate(newDate);
                }
                if (newDate && onSelectedDateChange) {
                  onSelectedDateChange(newDate);
                }
              }

              if (newDate) {
                setFilterPeriod("all");
              }
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
            placeholder="Fecha específica"
          />
          {specificDate && (
            <button
              onClick={() => {
                setSpecificDate("");
                setFilterPeriod("all");
                if (onSelectDate) {
                  onSelectDate(null);
                } else if (onFetchDepositsByPeriod) {
                  onFetchDepositsByPeriod("all");
                }
                if (!onSelectDate && onSelectedDateChange) {
                  onSelectedDateChange(null);
                }
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Limpiar fecha"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
