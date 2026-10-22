"use client";

import { useEffect, useRef } from "react";
import { saveTimeZone } from "@/app/app/settings/actions";

export function TimezoneSync() {
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    // Once per browser session is enough: saving on every page load also
    // raced with server redirects and logged React errors.
    try {
      if (sessionStorage.getItem("vow_tz") === tz) return;
      sessionStorage.setItem("vow_tz", tz);
    } catch {
      // private mode: just save
    }
    saveTimeZone(tz);
  }, []);
  return null;
}
