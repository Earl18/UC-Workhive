"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  X, Send, Sparkles, Loader2, Trash2, ChevronDown, Hexagon,
  ArrowDown, Zap,
} from "lucide-react";
import { HiveBotLogo } from "@/components/shared/hive-bot-logo";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  time: string;
};

const easeOut = [0.16, 1, 0.3, 1] as const;

const SUGGESTIONS: Record<string, string[]> = {
  public: [
    "What is WorkHive?",
    "How do I apply for a job?",
    "What portals are available?",
    "How do I sign in?",
  ],
  employee: [
    "How do I clock in?",
    "How do I file a leave?",
    "Where can I upload documents?",
    "How does QR attendance work?",
  ],
  hr: [
    "How do I approve a leave?",
    "How do I import employees from Excel?",
    "How does interview scoring work?",
    "How do I schedule an interview?",
  ],
  admin: [
    "How do I toggle a feature?",
    "How do I set up GPS zones?",
    "How do I change a user's role?",
    "What's in the audit log?",
  ],
};

function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function AIAssistant({ context, raised = false }: { context: "public" | "employee" | "hr" | "admin"; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        context === "public"
          ? "Hi! I'm HiveBot 🐝. I can help with public WorkHive information, careers, and signing in."
          : `Hi! I'm HiveBot 🐝. I can help with the ${context} portal and public WorkHive information.`,
      time: nowTime(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 300);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const openedAtY = window.scrollY;
    const closeOnPageScroll = () => {
      if (Math.abs(window.scrollY - openedAtY) > 2) setOpen(false);
    };
    window.addEventListener("scroll", closeOnPageScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeOnPageScroll);
  }, [open]);

  // Track scroll position to show "jump to latest" button
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!isNearBottom);
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: message, time: nowTime() },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response, time: nowTime() }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Sorry, something went wrong. Please try again.", time: nowTime() },
        ]);
      }
      if (!open) setHasUnread(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment.", time: nowTime() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          context === "public"
            ? "Chat cleared! Ask me anything about WorkHive 🐝"
            : `Chat cleared! How can I help with the ${context} portal? 🐝`,
        time: nowTime(),
      },
    ]);
  };

  const suggestions = SUGGESTIONS[context] ?? SUGGESTIONS.public;

  return (
    <>
      {/* ===== Floating Action Button =====
          Background-free: the gold HiveBot mark IS the button (no disc, no
          glow). The fixed wrapper is exactly the button's size; tooltip and
          badge anchor to THIS wrapper so they never drift. */}
      <div className={cn("hivebot-launcher fixed right-4 z-[100] h-14 w-14 sm:right-5 sm:h-[60px] sm:w-[60px]", raised && "hivebot-launcher--raised")}>
        {/* === Hover tooltip ("Ask HiveBot") ===
            Anchored to the vertical centre of the button, sits to the left. */}
        <AnimatePresence>
          {!open && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg sm:block"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-gold" />
                Ask HiveBot
              </span>
              {/* Tail pointing right toward the button */}
              <span className="absolute right-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-card" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* === The button ===
            Transparent hit-area — the gold mark floats free. grid +
            place-items-center avoids inline-baseline drift so the logo is
            pixel-centred; hover tint + drop-shadow keep the affordance. */}
        <motion.button
          onClick={() => {
            setOpen((value) => !value);
            setHasUnread(false);
          }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="relative grid h-14 w-14 place-items-center rounded-full transition-colors duration-200 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 sm:h-[60px] sm:w-[60px]"
          aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        >
          {/* Icon (logo when closed, chevron when open) */}
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
                className="relative z-10 flex"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.28))" }}
              >
                <ChevronDown className="h-6 w-6 text-gold" />
              </motion.span>
            ) : (
              <motion.span
                key="bot"
                initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
                className="relative z-10 flex"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.28))" }}
              >
                <HiveBotLogo size={38} variant="solid" loading={loading} title="HiveBot AI" />
              </motion.span>
            )}
          </AnimatePresence>

          {/* Unread badge */}
          <AnimatePresence>
            {!open && hasUnread && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -left-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-gold text-[10px] font-bold text-gold-foreground shadow"
              >
                1
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ===== Chat panel ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92, transformOrigin: "bottom right" }}
            transition={{ duration: 0.28, ease: easeOut }}
            className={cn("hivebot-panel fixed inset-x-3 z-[100] flex h-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 sm:inset-x-auto sm:right-5 sm:w-[390px]", raised && "hivebot-panel--raised")}
            role="dialog"
            aria-label="WorkHive AI Assistant chat"
          >
            {/* ===== Header (gradient + honeycomb) ===== */}
            <div className="relative overflow-hidden border-b border-border bg-primary px-4 py-3.5 text-primary-foreground">
              {/* Decorative hexagons */}
              <span className="hexagon pointer-events-none absolute -right-3 -top-4 h-14 w-12 bg-white/5" aria-hidden />
              <span className="hexagon pointer-events-none absolute right-10 -top-5 h-10 w-9 bg-white/5" aria-hidden />
              <div className="relative flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  <HiveBotLogo size={26} variant="solid" loading={loading} title="HiveBot AI" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    HiveBot
                    <span className="flex items-center gap-0.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold">
                      <Zap className="h-2 w-2" /> AI
                    </span>
                  </p>
                  <p className="truncate text-[10px] text-primary-foreground/70">
                    WorkHive Assistant · {context === "public" ? "Visitor mode" : `${context.charAt(0).toUpperCase()}${context.slice(1)} portal`}
                  </p>
                </div>
                <button
                  onClick={clearChat}
                  className="rounded-lg p-1.5 text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ===== Messages ===== */}
            <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 space-y-3 overflow-y-auto scroll-thin bg-muted/40 p-3 sm:p-4">
              {/* Date divider */}
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">Today</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: easeOut }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <div className="mr-2 mt-auto flex h-7 w-7 shrink-0 items-center justify-center">
                      <HiveBotLogo size={18} variant="solid" title="HiveBot" />
                    </div>
                  )}
                  <div className={cn("max-w-[78%]", m.role === "user" && "flex flex-col items-end")}>
                    <div
                      className={cn(
                        "relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                        m.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-card text-foreground"
                      )}
                    >
                      {m.content}
                      {/* Bubble tail */}
                      <span
                        className={cn(
                          "absolute bottom-0 h-3 w-3",
                          m.role === "user"
                            ? "-right-1 rounded-br-md bg-primary [clip-path:polygon(0_0,100%_100%,0_100%)]"
                            : "-left-1 rounded-bl-md bg-card [clip-path:polygon(100%_0,100%_100%,0_100%)]"
                        )}
                        aria-hidden
                      />
                    </div>
                    <p className={cn("mt-1 px-1 text-[9px] text-muted-foreground/70", m.role === "user" && "text-right")}>
                      {m.time}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="mr-2 mt-auto flex h-7 w-7 shrink-0 items-center justify-center">
                    <HiveBotLogo size={18} variant="solid" loading={loading} title="HiveBot" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5 shadow-sm">
                    <Hexagon className="h-2 w-2 animate-bounce text-gold [animation-delay:0ms]" />
                    <Hexagon className="h-2 w-2 animate-bounce text-gold [animation-delay:150ms]" />
                    <Hexagon className="h-2 w-2 animate-bounce text-gold [animation-delay:300ms]" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Scroll-to-bottom button */}
            <AnimatePresence>
              {showScrollBtn && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  onClick={() => {
                    const el = scrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                  }}
                  className="absolute bottom-[92px] right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label="Scroll to latest"
                >
                  <ArrowDown className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* ===== Suggestions ===== */}
            <AnimatePresence>
              {messages.length <= 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-border bg-card"
                >
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-2.5">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={s}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        onClick={() => send(s)}
                        className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        <Sparkles className="h-2.5 w-2.5 text-gold" />
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ===== Input ===== */}
            <div className="border-t border-border bg-card p-3">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
                <div className="wh-input-wrap relative flex-1">
                  <Hexagon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold" />
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask HiveBot anything…"
                    className="pl-8 pr-3"
                    disabled={loading}
                    maxLength={500}
                  />
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={loading || !input.trim()}
                    className="bg-gradient-to-br from-primary to-primary/80 shadow-md"
                    aria-label="Send message"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </form>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[9px] leading-tight text-muted-foreground/60">
                <ShieldMini />
                <span>
                  HiveBot can make mistakes.
                  <span className="hidden sm:inline"> For official matters, contact hr.south@uc.edu.ph</span>
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ShieldMini() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
