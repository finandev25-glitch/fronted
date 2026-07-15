import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Muestra un numero que hace un pequeño "pop" vertical cuando cambia de valor.
 * Respeta prefers-reduced-motion (renderiza el numero plano sin animar).
 */
export function AnimatedCount({ value, className = "" }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={`relative inline-flex justify-center overflow-hidden ${className}`}>
      {/* Reserva el ancho para que el pill no salte de tamaño al animar */}
      <span className="invisible">{value}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 30 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default AnimatedCount;
