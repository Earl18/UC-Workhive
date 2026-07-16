"use client";

import { useState } from "react";
import { useWorkHive } from "@/lib/store";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useSystemSettings } from "@/hooks/use-system-settings";

export function PublicHeader() {
  const { setView, view } = useWorkHive();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { label: string; view: typeof view }[] = [
    { label: "Home", view: "public:landing" },
    { label: "About", view: "public:about" },
    { label: "Careers", view: "public:careers" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button onClick={() => setView("public:landing")} className="flex min-w-0 items-center justify-self-start">
          <WorkHiveLogo size={56} />
        </button>
        <nav className="hidden min-w-0 items-center gap-2 justify-self-center md:flex">
          {navItems.map((item) => (
            <Button
              key={item.view}
              variant="ghost"
              onClick={() => setView(item.view)}
              className={cn(
                "h-11 px-4 text-sm font-medium lg:px-5 lg:text-base",
                view === item.view && "bg-primary/10 text-primary",
              )}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setView("public:login")}
            className="hidden h-11 px-4 text-sm md:inline-flex lg:px-6 lg:text-base"
          >
            Sign In
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 py-3 md:hidden">
          {navItems.map((item) => (
            <Button
              key={item.view}
              variant="ghost"
              className="h-10 w-full justify-start text-sm"
              onClick={() => {
                setView(item.view);
                setMobileOpen(false);
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            className="mt-2 h-10 w-full text-sm"
            onClick={() => {
              setView("public:login");
              setMobileOpen(false);
            }}
          >
            Sign In
          </Button>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { setView } = useWorkHive();
  const { data } = useSystemSettings();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const campusAddress = settings?.campusAddress ?? "Sanciangko St., Cebu City, 6000 Cebu, Philippines";
  const hrEmail = settings?.hrEmail ?? "hr.south@uc.edu.ph";
  const contactNumber = settings?.contactNumber ?? "(032) 412-1234";
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden text-white" style={{ background: "linear-gradient(to bottom right, #3d6af0 0%, #1f4cae 45%, #14356f 100%)" }}>
      <div className="sidebar-honeycomb absolute inset-0 opacity-25" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2">
            <WorkHiveLogo size={36} light />
            <p className="mt-3 max-w-sm text-sm text-white/75">
              The Human Resource Information System of {organizationName}. Modernizing attendance, leave, and recruitment in one hive.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li><button onClick={() => setView("public:landing")} className="text-left hover:text-gold">Home</button></li>
              <li><button onClick={() => setView("public:about")} className="text-left hover:text-gold">About</button></li>
              <li><button onClick={() => setView("public:careers")} className="text-left hover:text-gold">Careers</button></li>
              <li><button onClick={() => setView("public:login")} className="text-left hover:text-gold">Employee Sign In</button></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">Contact</h4>
            <ul className="space-y-2 text-sm text-white/75 break-words">
              <li>{organizationName}</li>
              <li>{campusAddress}</li>
              <li>{hrEmail}</li>
              <li>{contactNumber}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-white/15 pt-6 text-center text-xs text-white/55">
          (c) {currentYear} {organizationName} - Human Resource Department. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
