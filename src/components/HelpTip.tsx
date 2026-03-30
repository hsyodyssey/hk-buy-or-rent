"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  text: string;
  className?: string;
}

export default function HelpTip({ text, className = "" }: Props) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition(rect.top < 120 ? "bottom" : "top");
    }
  }, [show]);

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-zinc-300 text-zinc-400 text-[11px] font-medium cursor-help hover:border-zinc-500 hover:text-zinc-600 transition-colors ml-1">
        ?
      </span>
      {show && (
        <span
          className={`absolute z-50 w-56 px-3 py-2 text-xs leading-relaxed text-zinc-700 bg-white border border-zinc-200 rounded-lg shadow-lg ${
            position === "top"
              ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
              : "top-full mt-2 left-1/2 -translate-x-1/2"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
