"use client";

import { Construction, Wrench } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type DevelopmentPageOverlayProps = {
  title: string;
  description: string;
};

export function DevelopmentPageOverlay({
  title,
  description,
}: DevelopmentPageOverlayProps) {
  return (
    <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-br from-slate-50 via-white to-blue-50/80 shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,78,216,0.10),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.10),_transparent_34%)]" />
      <div className="relative flex min-h-[calc(100vh-9rem)] items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-2xl border-primary/15 bg-white/95 shadow-2xl backdrop-blur">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center md:px-10 md:py-14">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
              <Construction className="h-10 w-10" />
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-800">
              <Wrench className="h-4 w-4" /> Currently in development
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 md:text-lg">{description}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
