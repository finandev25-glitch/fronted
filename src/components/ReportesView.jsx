import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext.jsx';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  BarChart3,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchReportesSummary, fetchReportesTendencia } from '../features/reportes/api/reportesApi.js';

const ReportesView = () => {
  const { currentUser } = useContext(AuthContext);
  const [summary, setSummary] = useState([]);
  const [tendencia, setTendencia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('mes');
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState('semana');

  const isAuthenticated = !!currentUser;

  // Función para exportar a PDF capturando toda la página
  const handleExportPDF = async () => {
    try {
      const reportContainer = document.querySelector('.p-6.bg-gray-50');

      if (!reportContainer) {
        alert('No se pudo encontrar el contenido para exportar');
        return;
      }

      const canvas = await html2canvas(reportContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Reporte_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      alert('Hubo un error al generar el PDF. Por favor, intenta nuevamente.');
    }
  };

  const fetchReports = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [summaryData, tendenciaData] = await Promise.all([
        fetchReportesSummary(selectedPeriod),
        fetchReportesTendencia(selectedTrendPeriod)
      ]);

      setSummary(Array.isArray(summaryData?.summary) ? summaryData.summary : []);
      setTendencia(Array.isArray(tendenciaData?.tendencia) ? tendenciaData.tendencia : []);
    } catch (err) {
      console.error('Error al cargar reportes:', err);
      setError(err.message || 'No se pudieron cargar los reportes.');
      setSummary([]);
      setTendencia([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedPeriod, selectedTrendPeriod]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">
            Inicia sesión para ver los reportes.
          </p>
        </div>
      </div>
    );
  }

  const usdData = summary.find((s) => s.moneda === 'USD');
  const penData = summary.find((s) => s.moneda === 'PEN');
  const cantidadTotal = summary.reduce((sum, s) => sum + (s.cantidadDepositos || 0), 0);
  const validadosTotal = summary.reduce((sum, s) => sum + (s.depositosValidados || 0), 0);
  const percentageValidated = cantidadTotal > 0 ? ((validadosTotal / cantidadTotal) * 100).toFixed(1) : '0.0';

  const totalConfirmados = tendencia.reduce((sum, item) => sum + (item.confirmados || 0), 0);
  const totalRechazados = tendencia.reduce((sum, item) => sum + (item.rechazados || 0), 0);
  const totalTendencia = totalConfirmados + totalRechazados;
  const tasaAprobacion = totalTendencia > 0 ? ((totalConfirmados / totalTendencia) * 100).toFixed(0) : '0';

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Reportes y Análisis
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dashboard financiero y estadísticas de depósitos.
          </p>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="mes">Este Mes</option>
            <option value="semana">Esta Semana</option>
            <option value="hoy">Hoy</option>
          </select>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center space-x-2 transition-colors"
          >
            <Download size={16} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      ) : (
        <>
          {/* Summary Cards - Separadas por moneda */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-lg p-6 border border-emerald-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">💵 Total USD</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    $ {(usdData?.totalDepositos || 0).toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-lg p-6 border border-amber-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-semibold">💰 Total PEN</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    S/ {(penData?.totalDepositos || 0).toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cantidad Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cantidadTotal.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Validados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {validadosTotal.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {percentageValidated}% del total
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* Validados vs Rechazados */}
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  📈 Validados vs Rechazados
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cantidad de depósitos por estado
                </p>
              </div>
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setSelectedTrendPeriod('semana')}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    selectedTrendPeriod === 'semana'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600'
                  }`}
                >
                  7 días
                </button>
                <button
                  onClick={() => setSelectedTrendPeriod('mes')}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    selectedTrendPeriod === 'mes'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600'
                  }`}
                >
                  30 días
                </button>
                <button
                  onClick={() => setSelectedTrendPeriod('año')}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    selectedTrendPeriod === 'año'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600'
                  }`}
                >
                  Año
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Validados</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {totalConfirmados}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center">
                    <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">Rechazados</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {totalRechazados}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center">
                    <TrendingDown className="text-red-600 dark:text-red-400" size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                <div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Tasa Aprobación</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {tasaAprobacion}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={tendencia} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorConfirmados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRechazados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="dia" stroke="#9ca3af" style={{ fontSize: '12px', fontWeight: '500' }} tickLine={false} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px', fontWeight: '500' }} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                    itemStyle={{ color: '#1f2937', fontWeight: '600', fontSize: '13px' }}
                    labelStyle={{ color: '#6b7280', fontWeight: '500', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Line
                    type="monotone"
                    dataKey="confirmados"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="✓ Validados"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 5, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                    fill="url(#colorConfirmados)"
                  />
                  <Line
                    type="monotone"
                    dataKey="rechazados"
                    stroke="#ef4444"
                    strokeWidth={3}
                    name="✗ Rechazados"
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 5, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                    fill="url(#colorRechazados)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesView;
