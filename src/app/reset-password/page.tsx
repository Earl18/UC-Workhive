"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/role-default-passwords";

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("type") === "recovery" ? params.get("access_token") ?? "" : "";
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setAccessToken(token));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, password }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to reset your password.");
      setDone(true);
      setAccessToken("");
      setPassword("");
      setConfirm("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset your password.");
    } finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md space-y-5 rounded-xl border bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-bold text-primary">WorkHive password reset</h1>
    {done ? <p>Your password has been changed. You can now sign in.</p> : accessToken ? <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
      <Input aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <Input aria-label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button disabled={busy} type="submit" className="w-full">{busy ? "Updating..." : "Set new password"}</Button>
    </form> : <p className="text-sm text-destructive">This recovery link is invalid or has expired. Request a new link from the sign in page.</p>}
    <Link href="/" className="block text-sm text-primary underline">Back to sign in</Link>
  </section></main>;
}
