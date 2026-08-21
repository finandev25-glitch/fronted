import React from "react";
import { Building, CreditCard, Hash, Calendar, DollarSign, User, Fingerprint, Info, MessageSquare } from "lucide-react";
import { FormRow } from "../../deposits/components/depositDetailModalHelpers.jsx";
import { campoVerificacion, claseSegunAccion, motivoVisible } from "../../deposits/utils/verificacionOcrHelpers.js";

export const DepositFormPanel = ({
  editableData,
  handleChange,
  isFieldsOnlyEdit,
  isFullEditDisabled,
  activeEmpresas,
  activeBancos,
  filteredAnexos,
  selectedMoneda,
  nroOperacionClasses,
  verificacionOcr,
}) => {
  const vMonto = campoVerificacion(verificacionOcr, "monto");
  const vMoneda = campoVerificacion(verificacionOcr, "moneda");
  const vFecha = campoVerificacion(verificacionOcr, "fecha_deposito");
  return (
    <>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Datos Editables del Depósito
                  </h4>

                  <div className="grid grid-cols-6 gap-3 mb-4">
                    {/* Fila 1: Empresa (ancho completo) */}
                    <div className="col-span-6">
                      <FormRow icon={Building} label="Empresa">
                        <select
                          name="empresa_id"
                          value={editableData.empresa_id}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? false : isFullEditDisabled
                          }
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 text-base disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${
                            !editableData.empresa_id
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400"
                          }`}
                        >
                          <option value="">Seleccionar</option>
                          {activeEmpresas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </FormRow>
                    </div>

                    {/* Fila 2: Banco (3 cols) + Anexo (3 cols) */}
                    <div className="col-span-3">
                      <FormRow icon={CreditCard} label="Banco">
                        <select
                          name="banco_id"
                          value={editableData.banco_id}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? false : isFullEditDisabled
                          }
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 font-mono text-base disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${
                            !editableData.banco_id
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400"
                          }`}
                        >
                          <option value="">Seleccionar</option>
                          {activeBancos.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.abreviatura}
                            </option>
                          ))}
                        </select>
                      </FormRow>
                    </div>
                    <div className="col-span-3">
                      <FormRow icon={Hash} label="Anexo">
                        <select
                          name="anexo"
                          value={editableData.anexo}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 font-mono text-base disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${
                            !editableData.anexo
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400"
                          }`}
                        >
                          <option value="">
                            {filteredAnexos.length === 0
                              ? "N/A"
                              : "Seleccionar"}
                          </option>
                          {filteredAnexos.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </FormRow>
                    </div>

                    {/* Fila 3: Fecha Depósito (ancho completo) */}
                    <div className="col-span-6">
                      <FormRow icon={Calendar} label="Fecha Depósito">
                        <input
                          type="date"
                          name="fecha_deposito"
                          value={editableData.fecha_deposito}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          title={motivoVisible(vFecha) || undefined}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-base disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${claseSegunAccion(vFecha?.accion)}`}
                        />
                        {motivoVisible(vFecha) && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{motivoVisible(vFecha)}</p>
                        )}
                      </FormRow>
                    </div>

                    {/* Fila 4: Nro. de operación (ancho completo, un único campo).
                        Antes habia dos cajas separadas: esta (editable, atada a
                        editableData.numero_operacion_banco) y una de solo lectura
                        "Nro. Op. Solicitante" mostrando deposit.numero_operacion.
                        Eso confundia porque parecian dos numeros distintos, cuando
                        en realidad solo NumeroOperacion se persiste en el backend
                        (ver useDepositActions.js: buildEditableFieldsForRequest ya
                        mapea este mismo campo a numeroOperacion). El valor de
                        deposit.numero_operacion (lo que tipeo el solicitante) sigue
                        siendo el que precarga este campo por defecto -- ver
                        useDepositForm.js -- solo se dejo de mostrar por separado. */}
                    <div className="col-span-6">
                      <FormRow icon={Hash} label="Número de operación">
                        <input
                          type="text"
                          name="numero_operacion_banco"
                          value={editableData.numero_operacion_banco}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 font-mono transition-colors duration-200 text-lg disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${nroOperacionClasses}`}
                          placeholder="pega la operacion segun la web del banco"
                        />
                      </FormRow>
                    </div>

                    {/* Fila 5: Importe (3 cols) + Moneda (3 cols) */}
                    <div className="col-span-3">
                      <FormRow icon={DollarSign} label="Importe">
                        <input
                          type="number"
                          name="monto"
                          value={editableData.monto}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          title={motivoVisible(vMonto) || undefined}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-lg font-bold text-right disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${claseSegunAccion(vMonto?.accion)}`}
                          placeholder="0.00"
                          step="0.01"
                        />
                        {motivoVisible(vMonto) && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{motivoVisible(vMonto)}</p>
                        )}
                      </FormRow>
                    </div>
                    <div className="col-span-3">
                      <FormRow icon={DollarSign} label="Moneda">
                        <select
                          name="moneda"
                          value={selectedMoneda}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          title={motivoVisible(vMoneda) || undefined}
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 text-lg disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400 ${
                            !selectedMoneda
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : claseSegunAccion(vMoneda?.accion)
                          }`}
                        >
                          <option value="">Seleccionar</option>
                          <option value="PEN">Soles (PEN)</option>
                          <option value="USD">Dólares (USD)</option>
                        </select>
                        {motivoVisible(vMoneda) && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{motivoVisible(vMoneda)}</p>
                        )}
                      </FormRow>
                    </div>

                    {/* Fila 6: Cliente (ancho completo) */}
                    <div className="col-span-6">
                      <FormRow icon={User} label="Cliente">
                        <input
                          type="text"
                          name="cliente"
                          value={editableData.cliente}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-base disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400"
                          placeholder="Nombre del cliente"
                        />
                      </FormRow>
                    </div>

                    {/* Campo Observaciones ocultado por petición del usuario
                    <div className="col-span-6">
                      <FormRow
                        icon={MessageSquare}
                        label="Observaciones (Verificador)"
                      >
                        <textarea
                          name="observaciones"
                          rows="2"
                          value={editableData.observaciones}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700/50 dark:disabled:text-gray-400"
                          placeholder="Añadir notas o comentarios sobre la validación..."
                        />
                      </FormRow>
                    </div>
                    */}
                  </div>


    </>
  );
};
