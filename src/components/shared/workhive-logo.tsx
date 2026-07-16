"use client";

import Image from "next/image";

export function WorkHiveLogo({
  size = 56,
  showText = true,
  light = false,
}: {
  size?: number;
  showText?: boolean;
  light?: boolean;
}) {
  const titleSize = Math.max(16, size * 0.52);
  const subtitleSize = Math.max(10, size * 0.17);

  return (
    <div className="flex select-none items-center gap-3">
      <div
        className="relative shrink-0 rounded-md p-1"
        style={{ width: size, height: size }}
      >
        <Image
          src="/workhive-logo.png"
          alt="UC WorkHive"
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <div
            className={`font-bold tracking-tight ${light ? "text-white" : "text-foreground"}`}
            style={{ fontSize: titleSize }}
          >
            Work<span className="text-gold">Hive</span>
          </div>
          <div
            className={`whitespace-nowrap font-medium uppercase ${light ? "text-white/70" : "text-muted-foreground"}`}
            style={{ fontSize: subtitleSize, letterSpacing: "0.2em" }}
          >
            UC South Campus - HRMS
          </div>
        </div>
      )}
    </div>
  );
}



