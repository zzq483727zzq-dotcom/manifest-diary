"use client";

interface IntentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export function IntentionInput({ value, onChange, onSubmit, isProcessing }: IntentionInputProps) {
  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isProcessing) { e.preventDefault(); onSubmit(); } }}
        placeholder="写下你的意图、愿望、或者感谢……"
        disabled={isProcessing}
        rows={4}
        className="w-full bg-white/5 border border-rose-gold/30 rounded-2xl px-5 py-4 text-white/90 placeholder-white/30 resize-none outline-none focus:border-rose-gold/60 focus:shadow-[0_0_20px_rgba(255,182,193,0.15)] transition-all duration-300 disabled:opacity-50"
      />
      <div className="flex items-center justify-center">
        <button
          onClick={onSubmit}
          disabled={!value.trim() || isProcessing}
          className="px-6 py-2.5 rounded-full text-sm font-medium bg-gradient-to-r from-rose-gold/80 to-pink-400/80 text-white shadow-[0_0_16px_rgba(255,182,193,0.3)] hover:shadow-[0_0_24px_rgba(255,182,193,0.5)] disabled:opacity-40 disabled:shadow-none transition-all duration-300"
        >
          {isProcessing ? "宇宙回声中…" : "✨ 写下意图"}
        </button>
      </div>
      <p className="text-center text-white/20 text-xs">Ctrl+Enter 提交</p>
    </div>
  );
}