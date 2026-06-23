"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

/**
 * Ceremony-grade intention input.
 * - Focus brings a rose-gold border + glow (var(--shadow-glow))
 * - Stardust sparkles orbit the textarea while focused
 * - Submit button: rose-gold gradient + shimmer + hover glow + tap spring
 * - Ctrl/Cmd+Enter submits (unchanged behavior)
 */
export function IntentionInput({ value, onChange, onSubmit, isProcessing }: IntentionInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sparkle positions around the border (precomputed so they don't jump each render)
  const sparkles = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2,
      radius: 30 + Math.random() * 10,
      size: 2 + Math.random() * 1.5,
      delay: i * 0.18,
    }))
  ).current;

  // Re-trigger shimmer key on each submit so the sweep replays
  const [shimmerKey, setShimmerKey] = useState(0);
  useEffect(() => {
    if (isProcessing) setShimmerKey((k) => k + 1);
  }, [isProcessing]);

  const canSubmit = value.trim().length > 0 && !isProcessing;

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      <div className="relative">
        {/* Stardust sparkles orbiting the input while focused */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              key="sparkles"
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {sparkles.map((s, i) => (
                <motion.span
                  key={i}
                  className="absolute block rounded-full"
                  style={{
                    width: s.size,
                    height: s.size,
                    background:
                      "radial-gradient(circle, rgba(255,224,200,0.95) 0%, rgba(244,182,215,0.4) 60%, rgba(244,114,182,0) 100%)",
                    boxShadow: "0 0 6px rgba(244,182,215,0.7)",
                    left: "50%",
                    top: "50%",
                  }}
                  animate={{
                    x: [
                      Math.cos(s.angle) * s.radius,
                      Math.cos(s.angle + Math.PI * 2) * s.radius,
                    ],
                    y: [
                      Math.sin(s.angle) * s.radius,
                      Math.sin(s.angle + Math.PI * 2) * s.radius,
                    ],
                    opacity: [0.2, 1, 0.2],
                    scale: [0.6, 1.1, 0.6],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "linear",
                    delay: s.delay,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isProcessing) {
              e.preventDefault();
              onSubmit();
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="写下你的意图、愿望、或感谢……宇宙会听见"
          disabled={isProcessing}
          rows={4}
          className="relative w-full bg-white/5 border rounded-2xl px-5 py-4 text-white/90 placeholder:text-white/30 resize-none outline-none transition-all duration-500 disabled:opacity-50"
          style={{
            borderColor: isFocused
              ? "rgba(244,182,215,0.7)"
              : "rgba(244,182,215,0.3)",
            boxShadow: isFocused ? "var(--shadow-glow)" : "none",
          }}
        />
      </div>

      <div className="flex items-center justify-center">
        <motion.button
          onClick={onSubmit}
          disabled={!canSubmit}
          whileHover={canSubmit ? { scale: 1.04 } : undefined}
          whileTap={canSubmit ? { scale: 0.96 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="relative overflow-hidden px-7 py-2.5 rounded-full text-sm font-medium text-white transition-colors duration-300 disabled:opacity-40"
          style={{
            background: canSubmit
              ? "linear-gradient(135deg, rgba(244,114,182,0.85), rgba(192,132,252,0.85))"
              : "linear-gradient(135deg, rgba(244,114,182,0.4), rgba(192,132,252,0.4))",
            boxShadow: canSubmit
              ? "0 0 20px rgba(244,114,182,0.4), 0 0 40px rgba(244,114,182,0.15)"
              : "none",
          }}
        >
          {/* Shimmer sweep */}
          {canSubmit && (
            <motion.span
              key={shimmerKey}
              className="pointer-events-none absolute inset-0"
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
              }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {isProcessing ? (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                宇宙回声中…
              </motion.span>
            ) : (
              <>✨ 写下意图</>
            )}
          </span>
        </motion.button>
      </div>

      <p className="text-center text-white/25 text-xs">Ctrl + Enter 提交</p>
    </div>
  );
}
