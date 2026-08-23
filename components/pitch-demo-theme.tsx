"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { markPitchDemoReady } from "@/lib/pitch-demo";

function isDemoPath() {
  return (
    /[?&]demo=1(?:&|$)/.test(window.location.search) ||
    window.location.pathname.includes("demo-hero-notice")
  );
}

export function PitchDemoTheme() {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (isDemoPath()) {
      setTheme("dark");
      markPitchDemoReady();
    }
  }, [setTheme]);

  return null;
}
