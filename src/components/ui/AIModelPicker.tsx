import React from "react";

export const AI_MODELS = [
  { key: "haiku", label: "Haiku 4.5", cost: 0.002, costLabel: "$0.002" },
  { key: "sonnet", label: "Sonnet 4.6", cost: 0.012, costLabel: "$0.012" },
  { key: "opus", label: "Opus 4.6", cost: 0.06, costLabel: "$0.06" },
] as const;

export type AIModelKey = typeof AI_MODELS[number]["key"];

interface AIModelPickerProps {
  value: AIModelKey;
  onChange: (model: AIModelKey) => void;
  compact?: boolean;
}

export default function AIModelPicker({ value, onChange, compact = false }: AIModelPickerProps): React.ReactElement {
  const selected = AI_MODELS.find(m => m.key === value) || AI_MODELS[0];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as AIModelKey)}
          className="themed-input px-2 py-1 rounded border border-[var(--border-input)] text-[10px] font-bold bg-[var(--bg-input)] text-[var(--text-primary)]"
        >
          {AI_MODELS.map(m => (
            <option key={m.key} value={m.key}>{m.label} ({m.costLabel})</option>
          ))}
        </select>
        <span className="text-[9px] text-[var(--text-muted)]">~{selected.costLabel}/call</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {AI_MODELS.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`flex-1 py-2 rounded-md text-[10px] font-bold border cursor-pointer ${
            value === m.key ? "text-white" : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"
          }`}
          style={value === m.key ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : {}}
        >
          {m.label} <span className="font-normal opacity-70">{m.costLabel}</span>
        </button>
      ))}
    </div>
  );
}
