import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import DepositCard from "../../../../entities/deposit/ui/DepositCard.jsx";

// Clase CSS (index.css) que dispara el flash segun el tipo de evento realtime.
const HIGHLIGHT_CLASS = {
  update: "rt-flash-update",
  insert: "rt-flash-insert",
};

export function KanbanColumnContent({
  deposits,
  onCardClick,
  selectedDepositId,
  highlights = {},
}) {
  const reduce = useReducedMotion();

  if (!deposits || deposits.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">No hay depósitos en este estado.</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {deposits.map((deposit) => {
        const flashClass = HIGHLIGHT_CLASS[highlights[deposit.id]] || "";

        return (
          <motion.div
            key={deposit.id}
            // layout="position" (no "true"): anima solo el reacomodo por
            // traslación, sin la corrección por escala de framer-motion que
            // rasteriza la card (y el logo) borrosos. Ver blur de imágenes
            // dentro de elementos con layout.
            layout={reduce ? false : "position"}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, transition: { duration: 0.18 } }
            }
            transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.6 }}
            className={`rounded-lg ${flashClass}`}
          >
            <DepositCard
              deposit={deposit}
              onClick={() => onCardClick(deposit)}
              isSelected={selectedDepositId === deposit.id}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

export default KanbanColumnContent;
