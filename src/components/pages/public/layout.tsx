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

  const navigateToTop = (view: Parameters<typeof setView>[0]) => {
    setView(view);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const navItems: { label: string; view: typeof view }[] = [
    { label: "Home", view: "public:landing" },
    { label: "About", view: "public:about" },
    { label: "Careers", view: "public:careers" },
    { label: "Privacy", view: "public:privacy" },
  ];

  return (
    <div className="h-16 shrink-0">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr]">
        <button onClick={() => navigateToTop("public:landing")} className="flex items-center justify-self-start">
          <WorkHiveLogo size={36} />
        </button>
        <nav className="hidden items-center gap-1 justify-self-center xl:flex">
          {navItems.map((item) => (
            <Button
              key={item.view}
              variant="ghost"
              size="sm"
              onClick={() => setView(item.view)}
              className={cn(view === item.view && "bg-primary/10 text-primary")}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center justify-self-end gap-1">
          <Button size="sm" onClick={() => navigateToTop("public:login")} className="hidden xl:inline-flex">
            Sign In
          </Button>
          <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 py-3 xl:hidden">
          {navItems.map((item) => (
            <Button
              key={item.view}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setView(item.view);
                setMobileOpen(false);
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            className="mt-2 w-full"
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
    </div>
  );
}

export function PublicFooter() {
  const { setView } = useWorkHive();
  const { data } = useSystemSettings();

  const navigateToTop = (view: Parameters<typeof setView>[0]) => {
    setView(view);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
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
              The Human Resource Information System of {organizationName}. Modernizing attendance, leave, recruitment, and records management in one hive.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/75">
              <li><button onClick={() => navigateToTop("public:landing")} className="text-left hover:text-gold">Home</button></li>
              <li><button onClick={() => navigateToTop("public:about")} className="text-left hover:text-gold">About</button></li>
              <li><button onClick={() => navigateToTop("public:careers")} className="text-left hover:text-gold">Careers</button></li>
              <li><button onClick={() => navigateToTop("public:privacy")} className="text-left hover:text-gold">Privacy Policy</button></li>
              <li><button onClick={() => navigateToTop("public:login")} className="text-left hover:text-gold">Employee Sign In</button></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gold">Legal & Contact</h4>
            <ul className="space-y-2 text-sm text-white/75 break-words">
              <li>{organizationName}</li>
              <li>{campusAddress}</li>
              <li>{hrEmail}</li>
              <li>{contactNumber}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/55 sm:flex-row">
          <p>(c) {currentYear} {organizationName} - Human Resource Department. All rights reserved.</p>
          <button onClick={() => navigateToTop("public:privacy")} className="transition-colors hover:text-gold">
            Privacy Policy
          </button>
        </div>
      </div>
    </footer>
  );
}


