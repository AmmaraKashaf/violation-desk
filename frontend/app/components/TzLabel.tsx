import { TIMEZONE_LABEL } from "../lib/display";

// Small "ET" tag placed after a time so it's clear which timezone it's in.
export default function TzLabel({ className = "" }: { className?: string }) {
  return <span className={`ml-1 text-[0.75em] font-medium text-slate-400 ${className}`}>{TIMEZONE_LABEL}</span>;
}
