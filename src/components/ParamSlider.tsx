"use client";

import { useRef, useState } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  parse?: (v: string) => number;
}

export default function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  parse,
}: Props) {
  const [localText, setLocalText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayed = localText !== null ? localText : format(value);

  function handleFocus() {
    setLocalText(format(value));
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalText(e.target.value);
  }

  function commit() {
    if (localText === null || localText.trim() === "") {
      setLocalText(null);
      return;
    }
    const raw = localText.replace(/[^0-9.\-]/g, "");
    if (raw === "") {
      setLocalText(null);
      return;
    }
    const parsed = parse ? parse(raw) : Number(raw);
    if (!isNaN(parsed) && isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
    setLocalText(null);
  }

  function handleBlur() {
    commit();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commit();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setLocalText(null);
      inputRef.current?.blur();
    }
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(Number(e.target.value));
  }

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-500">{label}</label>
        <input
          ref={inputRef}
          type="text"
          value={displayed}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-28 text-right text-sm font-mono font-semibold bg-transparent border-b border-zinc-300 text-zinc-800
                     focus:border-teal-600 focus:outline-none transition-colors px-1 py-0.5"
        />
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:shadow-md
                     [&::-webkit-slider-thumb]:hover:bg-teal-500 [&::-webkit-slider-thumb]:transition-colors"
          style={{
            background: `linear-gradient(to right, #0d9488 0%, #0d9488 ${pct}%, #e4e4e7 ${pct}%, #e4e4e7 100%)`,
          }}
        />
      </div>
    </div>
  );
}
