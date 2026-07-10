import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  Phone,
  MessageCircle,
  Search,
  User,
  Loader2,
} from "lucide-react";
import { apiGet } from "../services/backendApi.js";

const ContactosModal = ({ onClose }) => {
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAllContactos();
  }, []);

  const fetchAllContactos = async () => {
    setLoading(true);
    setError("");

    try {
      console.log("🔍 Obteniendo contactos desde sucursal_personal...");

      const response = await apiGet("/dashboard/bootstrap");
      const trabajadoresData = response.personal || [];

      if (!trabajadoresData.length) {
        setError("No hay contactos con teléfono registrado en el sistema.");
        setLoading(false);
        return;
      }

      // Transformar datos al formato esperado
      const contactosFinal = trabajadoresData.map((trabajador) => ({
        id: trabajador.id,
        nombre: trabajador.nombre,
        nombreCompleto: trabajador.nombre,
        telefono_origen: trabajador.telefono_origen,
        empresa: trabajador.empresa,
        es_responsable: trabajador.es_responsable,
        estado: trabajador.estado,
        sucursal: trabajador.sucursal,
      }));

      // Filtrar duplicados por teléfono
      const contactosUnicos = contactosFinal.reduce((acc, contacto) => {
        if (
          contacto &&
          !acc.find((t) => t.telefono_origen === contacto.telefono_origen)
        ) {
          acc.push(contacto);
        }
        return acc;
      }, []);

      console.log(`🎉 Total contactos únicos: ${contactosUnicos.length}`);
      setContactos(contactosUnicos);
    } catch (err) {
      console.error("❌ Error en fetchAllContactos:", err);
      setError(`Error al cargar contactos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar contactos basado en búsqueda
  const filteredContactos = contactos.filter((contacto) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      contacto.nombreCompleto?.toLowerCase().includes(searchLower) ||
      contacto.nombre?.toLowerCase().includes(searchLower) ||
      contacto.empresa?.toLowerCase().includes(searchLower) ||
      contacto.telefono_origen?.includes(searchTerm) ||
      contacto.sucursal?.nombre?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Contactos
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {loading
                    ? "Cargando..."
                    : `${filteredContactos.length} contactos encontrados`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nombre, empresa, sucursal o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              <span className="ml-3 text-gray-600 dark:text-gray-300">
                Cargando contactos...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchAllContactos}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : filteredContactos.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">
                {searchTerm
                  ? "No se encontraron contactos con ese criterio"
                  : "No hay contactos disponibles"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredContactos.map((contacto) => (
                <motion.div
                  key={`contacto-${contacto.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-800"
                >
                  {/* Badge de estado */}
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        contacto.es_responsable
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {contacto.es_responsable ? "Responsable" : "Trabajador"}
                    </span>
                    {contacto.estado === "activo" && (
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                  </div>

                  {/* Información del contacto */}
                  <div className="space-y-3">
                    {/* Nombre */}
                    <div className="flex items-start space-x-3">
                      <User className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {contacto.nombreCompleto || "Sin nombre"}
                        </p>
                        {contacto.empresa && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {contacto.empresa}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Sucursal */}
                    {contacto.sucursal && (
                      <div className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        <svg
                          className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-medium"
                            title={contacto.sucursal.nombre}
                          >
                            {contacto.sucursal.nombre}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Teléfono */}
                    {contacto.telefono_origen && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-mono">{contacto.telefono_origen}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Última actualización: {new Date().toLocaleTimeString("es-ES")}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ContactosModal;
