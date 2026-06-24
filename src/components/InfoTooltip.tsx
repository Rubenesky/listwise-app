"use client";

import { useState } from "react";

interface Props {
  content: string;
}

export default function InfoTooltip({ content }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-gray-400 hover:text-gray-500 transition-colors"
        aria-label="Más información"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {visible && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl pointer-events-none">
          {content}
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rotate-45 bg-gray-900" />
        </span>
      )}
    </span>
  );
}
