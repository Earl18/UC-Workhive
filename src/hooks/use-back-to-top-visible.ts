"use client";

import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
};

const getSnapshot = () => window.scrollY > 400;
const getServerSnapshot = () => false;

export function useBackToTopVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
