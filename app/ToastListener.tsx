"use client";

import { useEffect, useState } from "react";
import { Toast } from "./Toast";

export function ToastListener() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleToast(e: Event) {
      setMessage((e as CustomEvent<string>).detail);
    }
    window.addEventListener("forkcast:toast", handleToast);
    return () => window.removeEventListener("forkcast:toast", handleToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return <Toast message={message} />;
}
