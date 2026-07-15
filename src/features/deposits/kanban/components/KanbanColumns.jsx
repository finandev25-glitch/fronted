import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import { KANBAN_COLUMNS } from "../utils/kanbanHelpers.js";
import { useRealtimeHighlights } from "../hooks/useRealtimeHighlights.js";
import AnimatedCount from "./AnimatedCount.jsx";
import KanbanColumnContent from "./KanbanColumnContent.jsx";

// Variantes para la entrada escalonada de las columnas al montar el tablero.
const boardContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const columnItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 32 },
  },
};

function KanbanSection({ tone, title, count, isOpen, onToggle, children }) {
  const reduce = useReducedMotion();
  // overflow-hidden es necesario SOLO mientras dura la animación de altura
  // (para que el contenido no se desborde al colapsar/expandir). En reposo se
  // vuelve a overflow-visible para que la sombra del hover de las cards no
  // quede recortada, igual que en las columnas sin secciones (Confirmado).
  const [isAnimating, setIsAnimating] = useState(false);
  const tones = {
    blue: {
      line: "bg-blue-300 dark:bg-blue-700",
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-300 dark:border-blue-700",
    },
    orange: {
      line: "bg-orange-300 dark:bg-orange-700",
      text: "text-orange-700 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      border: "border-orange-300 dark:border-orange-700",
    },
    purple: {
      line: "bg-purple-300 dark:bg-purple-700",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30",
      border: "border-purple-300 dark:border-purple-700",
    },
  };

  const palette = tones[tone];

  return (
    <div className="mb-4">
      <div className="mb-2 flex cursor-pointer items-center gap-2 px-2 transition-opacity hover:opacity-80" onClick={onToggle}>
        <div className={`h-px flex-1 ${palette.line}`} />
        <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-wider ${palette.text} ${palette.bg} ${palette.border}`}>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
          {title} (<AnimatedCount value={count} />)
        </span>
        <div className={`h-px flex-1 ${palette.line}`} />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="section-content"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            onAnimationStart={() => setIsAnimating(true)}
            onAnimationComplete={() => setIsAnimating(false)}
            className={isAnimating && !reduce ? "overflow-hidden" : "overflow-visible"}
          >
            <div className="space-y-2 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KanbanColumnBody({
  columnId,
  groupedDeposits,
  validacionSeparated,
  pendientesSeparated,
  showNormales,
  setShowNormales,
  showAntiguos,
  setShowAntiguos,
  showPendientesEspeciales,
  setShowPendientesEspeciales,
  showPendientesOtros,
  setShowPendientesOtros,
  handleCardClick,
  selectedDepositId,
  highlights,
}) {
  if (columnId === "en_validacion") {
    return (
      <>
        {validacionSeparated.normales.length > 0 && (
          <KanbanSection
            tone="blue"
            title="Normales"
            count={validacionSeparated.normales.length}
            isOpen={showNormales}
            onToggle={() => setShowNormales(!showNormales)}
          >
            <KanbanColumnContent
              deposits={validacionSeparated.normales}
              onCardClick={handleCardClick}
              selectedDepositId={selectedDepositId}
              highlights={highlights}
            />
          </KanbanSection>
        )}

        {validacionSeparated.antiguos.length > 0 && (
          <KanbanSection
            tone="orange"
            title="Antiguos"
            count={validacionSeparated.antiguos.length}
            isOpen={showAntiguos}
            onToggle={() => setShowAntiguos(!showAntiguos)}
          >
            <KanbanColumnContent
              deposits={validacionSeparated.antiguos}
              onCardClick={handleCardClick}
              selectedDepositId={selectedDepositId}
              highlights={highlights}
            />
          </KanbanSection>
        )}

        {validacionSeparated.antiguos.length === 0 && validacionSeparated.normales.length === 0 && (
          <KanbanColumnContent deposits={[]} onCardClick={handleCardClick} selectedDepositId={selectedDepositId} highlights={highlights} />
        )}
      </>
    );
  }

  if (columnId === "procesado") {
    return (
      <>
        {pendientesSeparated.especiales.length > 0 && (
          <KanbanSection
            tone="purple"
            title="981199322"
            count={pendientesSeparated.especiales.length}
            isOpen={showPendientesEspeciales}
            onToggle={() => setShowPendientesEspeciales(!showPendientesEspeciales)}
          >
            <KanbanColumnContent
              deposits={pendientesSeparated.especiales}
              onCardClick={handleCardClick}
              selectedDepositId={selectedDepositId}
              highlights={highlights}
            />
          </KanbanSection>
        )}

        {pendientesSeparated.otros.length > 0 && (
          <KanbanColumnContent
            deposits={pendientesSeparated.otros}
            onCardClick={handleCardClick}
            selectedDepositId={selectedDepositId}
            highlights={highlights}
          />
        )}

        {pendientesSeparated.especiales.length === 0 && pendientesSeparated.otros.length === 0 && (
          <KanbanColumnContent deposits={[]} onCardClick={handleCardClick} selectedDepositId={selectedDepositId} highlights={highlights} />
        )}
      </>
    );
  }

  return (
    <KanbanColumnContent
      deposits={groupedDeposits[columnId]}
      onCardClick={handleCardClick}
      selectedDepositId={selectedDepositId}
      highlights={highlights}
    />
  );
}

export function KanbanColumns(props) {
  const {
    groupedDeposits,
    validacionSeparated,
    pendientesSeparated,
    showNormales,
    setShowNormales,
    showAntiguos,
    setShowAntiguos,
    showPendientesEspeciales,
    setShowPendientesEspeciales,
    showPendientesOtros,
    setShowPendientesOtros,
    handleCardClick,
    selectedDepositId,
    realtimeActivity,
  } = props;

  const reduce = useReducedMotion();
  const highlights = useRealtimeHighlights(realtimeActivity);

  // Props compartidos entre las dos variantes responsive (movil / desktop).
  const bodyProps = {
    groupedDeposits,
    validacionSeparated,
    pendientesSeparated,
    showNormales,
    setShowNormales,
    showAntiguos,
    setShowAntiguos,
    showPendientesEspeciales,
    setShowPendientesEspeciales,
    showPendientesOtros,
    setShowPendientesOtros,
    handleCardClick,
    selectedDepositId,
    highlights,
  };

  return (
    <>
      <LayoutGroup id="kanban-mobile">
        {/* En pantallas chicas / extensión: los tableros crecen de forma
            natural y el scroll vertical lo maneja el contenedor principal
            (main). Todos los tableros vienen expandidos por defecto. */}
        <div className="flex flex-col space-y-4 lg:hidden">
          {KANBAN_COLUMNS.map((column) => (
            <details
              key={column.id}
              className="group overflow-hidden rounded-xl border border-gray-200/80 bg-gray-100/70 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/70"
              open
            >
              <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                  {column.title}
                </h3>
                <div className="flex items-center gap-4">
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    <AnimatedCount value={groupedDeposits[column.id]?.length || 0} />
                  </span>
                  <ChevronRight className="text-gray-500 transition-transform duration-200 group-open:rotate-90 dark:text-gray-400" size={14} />
                </div>
              </summary>
              <div className="space-y-2 border-t border-gray-200 p-3 dark:border-gray-800">
                <KanbanColumnBody columnId={column.id} {...bodyProps} />
              </div>
            </details>
          ))}
        </div>
      </LayoutGroup>

      <LayoutGroup id="kanban-desktop">
        <motion.div
          className="hidden min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2 lg:grid lg:grid-cols-4"
          variants={reduce ? undefined : boardContainer}
          initial={reduce ? false : "hidden"}
          animate={reduce ? false : "show"}
        >
          {KANBAN_COLUMNS.map((column) => (
            <motion.div
              key={column.id}
              variants={reduce ? undefined : columnItem}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200/80 bg-gray-100/70 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900"
            >
              <div className="flex-shrink-0 border-b border-gray-200/80 p-4 dark:border-gray-700/80">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                    <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                    {column.title}
                  </h3>
                  <span className="rounded-full bg-gray-200 px-2 py-1 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    <AnimatedCount value={groupedDeposits[column.id]?.length || 0} />
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                <KanbanColumnBody columnId={column.id} {...bodyProps} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </LayoutGroup>
    </>
  );
}

export default KanbanColumns;
