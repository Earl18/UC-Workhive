"use client";

import { cn } from "@/lib/utils";

/** Hexagon-shaped avatar frame (honeycomb motif) */
export function HexagonAvatar({
  name,
  color = "#1e3a8a",
  size = 40,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn("hexagon flex items-center justify-center font-semibold text-white shrink-0", className)}
      style={{
        width: size,
        height: size * 1.1547,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        fontSize: size * 0.36,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

/** Small hexagon badge — for department tags / status chips */
export function HexagonBadge({
  children,
  color = "#1e3a8a",
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      <span
        className="hexagon inline-block"
        style={{ width: 8, height: 9.24, backgroundColor: color }}
      />
      {children}
    </span>
  );
}

/** Honeycomb background pattern wrapper */
export function HoneycombBg({ className }: { className?: string }) {
  return <div className={cn("honeycomb-bg absolute inset-0 -z-10", className)} />;
}

/** Hexagon cluster logo mark — small accent of people-icons in gold/navy */
export function HexagonCluster({ size = 24 }: { size?: number }) {
  return (
    <svg width={size * 2.2} height={size * 1.3} viewBox="0 0 44 26" fill="none" aria-hidden>
      <path d="M11 0L22 6.35V19.05L11 25.4L0 19.05V6.35Z" fill="#1e3a8a" opacity="0.9" />
      <path d="M33 0L44 6.35V19.05L33 25.4L22 19.05V6.35Z" fill="#f59e0b" opacity="0.85" />
      <circle cx="11" cy="13" r="2.4" fill="#fff" />
      <circle cx="33" cy="13" r="2.4" fill="#fff" />
    </svg>
  );
}

/** Hexagon stat card with optional gold accent corner */
export function HexStatCard({
  label,
  value,
  sublabel,
  icon,
  accent = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm",
        accent ? "border-gold/40" : "border-border",
        className
      )}
    >
      {accent && (
        <span
          className="hexagon absolute -right-3 -top-3 opacity-90"
          style={{ width: 28, height: 32.3, backgroundColor: "var(--gold)" }}
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
