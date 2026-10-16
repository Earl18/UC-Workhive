"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { Quote, Sparkles } from "lucide-react";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { useSystemSettings } from "@/hooks/use-system-settings";

const easeOut = [0.16, 1, 0.3, 1] as const;

type Feature = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  desc: string;
};

export function AuthBrandPanel({
  headline,
  headlineAccent,
  subline,
  features,
}: {
  headline: string;
  headlineAccent: string;
  subline: string;
  features: Feature[];
}) {
  const { data: systemSettingsData } = useSystemSettings();
  const organizationName = systemSettingsData?.settings.organizationName ?? "University of Cebu - South Campus";

  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: easeOut }}
      className="wh-gradient-mesh relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between"
    >
      <div className="sidebar-honeycomb pointer-events-none absolute inset-0 opacity-60" />
      <div className="wh-pulse-glow pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
      <div className="wh-pulse-glow pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-primary/40 blur-3xl" style={{ animationDelay: "2.5s" }} />
      <div className="wh-pulse-glow pointer-events-none absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-gold/10 blur-3xl" style={{ animationDelay: "1.2s" }} />

      <div className="pointer-events-none absolute right-[-80px] top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 xl:block">
        <div className="wh-spin-slow h-full w-full">
          <svg viewBox="0 0 400 400" className="h-full w-full">
            <g fill="none" stroke="#f8b84e" strokeWidth="1.6" opacity="0.38">
              {[120, 150, 180].map((radius, index) => (
                <polygon key={index} points={Array.from({ length: 6 }, (_, point) => {
                  const angle = (point * 60 - 30) * (Math.PI / 180);
                  return `${(200 + radius * Math.cos(angle)).toFixed(3)},${(200 + radius * Math.sin(angle)).toFixed(3)}`;
                }).join(" ")} />
              ))}
            </g>
            {Array.from({ length: 6 }, (_, index) => {
              const angle = index * 60 * (Math.PI / 180);
              return <polygon key={index} points={hexPoints(200 + 180 * Math.cos(angle), 200 + 180 * Math.sin(angle), 10)} fill="#ffc247" opacity="0.82" />;
            })}
          </svg>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {[
          { t: "16px", l: "20px", s: 84, cls: "wh-float", d: "0s", op: 0.32 },
          { t: "70%", l: "15%", s: 44, cls: "wh-float-slow", d: "1.5s", op: 0.09 },
          { t: "30%", l: "82%", s: 52, cls: "wh-float", d: "0.8s", op: 0.09 },
          { t: "82%", l: "78%", s: 38, cls: "wh-float-slow", d: "2.2s", op: 0.09 },
        ].map((hexagon, index) => (
          <div
            key={index}
            className={`hexagon absolute bg-white ${hexagon.cls}`}
            style={{ top: hexagon.t, left: hexagon.l, width: hexagon.s, height: hexagon.s * 1.1547, animationDelay: hexagon.d, opacity: hexagon.op }}
          />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: easeOut }} className="relative z-10 p-10">
        <Link href="/" className="flex items-center transition-transform hover:scale-[1.02]">
          <WorkHiveLogo size={56} light />
        </Link>
      </motion.div>

      <div className="relative z-10 px-10 pb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35, ease: easeOut }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          <Sparkles className="h-3 w-3" /> The Hive of Modern HR
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease: easeOut }} className="text-4xl font-bold leading-tight text-white xl:text-5xl">
          {headline}<br />
          <span className="wh-shimmer-gold font-extrabold" data-text={headlineAccent}>{headlineAccent}</span><span className="text-white">.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6, ease: easeOut }} className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
          {subline}
        </motion.p>
        <div className="mt-8 space-y-3">
          {features.map((feature, index) => (
            <motion.div key={feature.label} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.75 + index * 0.12, ease: easeOut }} className="group flex items-center gap-3.5">
              <motion.div whileHover={{ scale: 1.1, rotate: 8 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="hexagon flex items-center justify-center bg-gradient-to-br from-primary to-primary/60 shadow-md" style={{ width: 38, height: 43.88 }}>
                <feature.icon className="h-4 w-4 text-gold" />
              </motion.div>
              <div>
                <div className="text-sm font-semibold text-white">{feature.label}</div>
                <div className="text-xs text-white/55">{feature.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1.1, ease: easeOut }} className="relative z-10 px-10 pb-10">
        <div className="max-w-xl rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <Quote className="h-4 w-4 text-gold" />
          <p className="mt-2 text-sm italic text-white/80">"Bee efficient. Bee organized. WorkHive brought our HR records into one place."</p>
          <p className="mt-2 text-xs font-medium text-white/50">- {organizationName} HR Team</p>
        </div>
        <p className="mt-5 text-[11px] text-white/40">(c) {new Date().getFullYear()} {organizationName} - Human Resource Department</p>
      </motion.div>
    </motion.div>
  );
}

function hexPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (index * 60 - 30) * (Math.PI / 180);
    return `${(cx + radius * Math.cos(angle)).toFixed(3)},${(cy + radius * Math.sin(angle)).toFixed(3)}`;
  }).join(" ");
}
