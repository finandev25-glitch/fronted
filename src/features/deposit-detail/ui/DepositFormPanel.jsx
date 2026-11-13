import React from "react";
import { Building, CreditCard, Hash, Calendar, DollarSign, User, Fingerprint, Info, MessageSquare, CheckCircle2, AlertTriangle } from "lucide-react";
import { FormRow, isNiubizBanco } from "../../deposits/components/depositDetailModalHelpers.jsx";
import { campoVerificacion, claseSegunAccion, motivoVisible } from "../../deposits/utils/verificacionOcrHelpers.js";

// Ícono acorde a la acción de verificación OCR: refuerza visualmente el
// texto de motivoVisible(), que antes era solo texto gris chico y se
// perdía fácil -- en particular el caso "ninguna" (Llama y OCR coinciden),
// que es la señal de confianza más común y la que menos destacaba.
const VerificacionIcon = ({ accion }) => {
  if (accion === "ninguna")
    return <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />;
  if (accion === "revision_manual")
    return <AlertTriangle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />;
  if (accion === "auto_corregido")
    return <Info className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />;
  return null;
};

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
  selectedBanco,
  deposit,
}) => {
  const vMonto = campoVerificacion(verificacionOcr, "monto");
  const vMoneda = campoVerificacion(verificacionOcr, "moneda");
  const vFecha = campoVerificacion(verificacionOcr, "fecha_deposito");
  return (
    <>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-zinc-200 mb-2">
                    Datos Editables del Depósito
                  </h4>

                  <div className="grid grid-cols-6 gap-3 mb-4">
                    {/* Fila 1: Empresa (ancho completo) */}
                    <div className="col-span-6">
                      <FormRow icon={Building} label="Empresa" required>
                        <select
                          id="field-empresa_id"
                          name="empresa_id"
                          value={editableData.empresa_id}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? false : isFullEditDisabled
                          }
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${
                            !editableData.empresa_id
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                      <FormRow icon={CreditCard} label="Banco" required>
                        <select
                          id="field-banco_id"
                          name="banco_id"
                          value={editableData.banco_id}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? false : isFullEditDisabled
                          }
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 font-mono text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${
                            !editableData.banco_id
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                      <FormRow icon={Hash} label="Anexo" required>
                        <select
                          id="field-anexo"
                          name="anexo"
                          value={editableData.anexo}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 font-mono text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${
                            !editableData.anexo
                              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                              : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${claseSegunAccion(vFecha?.accion)}`}
                        />
                        {motivoVisible(vFecha) && (
                          <p className="mt-1 flex items-center gap-1 text-[9px] leading-tight text-gray-600 dark:text-zinc-400">
                            <VerificacionIcon accion={vFecha?.accion} />
                            {motivoVisible(vFecha)}
                          </p>
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 font-mono transition-colors duration-200 text-lg disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${nroOperacionClasses}`}
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-lg font-bold text-right disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${claseSegunAccion(vMonto?.accion)}`}
                          placeholder="0.00"
                          step="0.01"
                        />
                        {motivoVisible(vMonto) && (
                          <p className="mt-1 flex items-center gap-1 text-[9px] leading-tight text-gray-600 dark:text-zinc-400">
                            <VerificacionIcon accion={vMonto?.accion} />
                            {motivoVisible(vMonto)}
                          </p>
                        )}
                      </FormRow>
                    </div>
                    <div className="col-span-3">
                      <FormRow icon={DollarSign} label="Moneda" required>
                        <select
                          id="field-moneda"
                          name="moneda"
                          value={selectedMoneda}
                          onChange={handleChange}
                          disabled={
                            isFieldsOnlyEdit ? true : isFullEditDisabled
                          }
                          title={motivoVisible(vMoneda) || undefined}
                          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 text-lg disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${
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
                          <p className="mt-1 flex items-center gap-1 text-[9px] leading-tight text-gray-600 dark:text-zinc-400">
                            <VerificacionIcon accion={vMoneda?.accion} />
                            {motivoVisible(vMoneda)}
                          </p>
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400"
                          placeholder="Nombre del cliente"
                        />
                      </FormRow>
                    </div>

                    {/* Fila 7: Número de Tarjeta -- solo depósitos Niubiz "Pago
                        con Link", y solo en la etapa de confirmación (mismo
                        criterio que el bloque equivalente del modo compacto
                        mas arriba en este archivo padre). */}
                    {isNiubizBanco(selectedBanco) &&
                      (deposit?.estado === "procesado" || deposit?.estado === "confirmado") && (
                        <div className="col-span-6">
                          <FormRow icon={CreditCard} label="Últimos 4 Dígitos de la Tarjeta">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              name="numero_tarjeta"
                              value={editableData.numero_tarjeta}
                              onChange={handleChange}
                              disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 font-mono text-base disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400 ${
                                !editableData.numero_tarjeta
                                  ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                                  : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 focus:ring-blue-500 dark:focus:ring-blue-400"
                              }`}
                              placeholder="Ej: 7801"
                            />
                          </FormRow>
                        </div>
                      )}

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
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm disabled:bg-gray-100 dark:disabled:bg-zinc-700/50 dark:disabled:text-zinc-400"
                          placeholder="Añadir notas o comentarios sobre la validación..."
                        />
                      </FormRow>
                    </div>
                    */}
                  </div>


    </>
  );
};
