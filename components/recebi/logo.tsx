import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="#c9ff3c" />
      <path d="M9 16.5 14 21l9-10" fill="none" stroke="#101c34" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-extrabold tracking-tight", className)}>
      <LogoMark className={markClassName} />
      <span>
        Recebi<span className="text-[#9bd100] dark:text-brand">.</span>
      </span>
    </span>
  );
}
