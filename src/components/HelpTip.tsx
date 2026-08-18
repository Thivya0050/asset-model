"use client";

import { CircleHelp } from "lucide-react";

/** Concise field help tooltip */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <CircleHelp
        size={13}
        className="text-[#9ca3af] hover:text-[#4b5563]"
        aria-hidden
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-52 -translate-x-1/2 rounded-[6px] bg-[#1a1d23] px-2.5 py-1.5 text-left text-[11px] font-normal leading-snug normal-case text-white opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
