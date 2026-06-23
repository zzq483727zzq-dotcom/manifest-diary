"use client";
import { motion, AnimatePresence } from "framer-motion";

interface EchoBubbleProps {
  echo: string;
  isLoading?: boolean;
}

/** Three breathing stardust dots — replaces the old spinner. */
function BreathingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: "var(--accent-rose)",
            boxShadow: "0 0 8px rgba(244,114,182,0.6)",
          }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        />
      ))}
    </span>
  );
}

export function EchoBubble({ echo, isLoading }: EchoBubbleProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
          className="mx-auto max-w-md px-6 py-4 rounded-2xl bg-white/5 border border-white/10"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <div className="flex items-center justify-center gap-3 text-white/50 text-sm tracking-wide">
            <BreathingDots />
            <span>宇宙正在倾听……</span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="echo"
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glow-border relative mx-auto max-w-md px-6 py-5 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(244,114,182,0.10), rgba(192,132,252,0.05))",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <p
            className="text-center text-white/90 text-base leading-relaxed italic"
            style={{ fontFamily: "'Georgia', 'Noto Serif SC', serif" }}
          >
            {echo}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
