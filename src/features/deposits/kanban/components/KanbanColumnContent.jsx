import { AnimatePresence, motion } from "framer-motion";
import DepositCard from "../../../../entities/deposit/ui/DepositCard.jsx";

export function KanbanColumnContent({ deposits, onCardClick, selectedDepositId }) {
  if (!deposits || deposits.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">No hay depósitos en este estado.</p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {deposits.map((deposit) => (
        <motion.div
          key={deposit.id}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <DepositCard
            deposit={deposit}
            onClick={() => onCardClick(deposit)}
            isSelected={selectedDepositId === deposit.id}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default KanbanColumnContent;
