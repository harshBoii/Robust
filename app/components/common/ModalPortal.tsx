"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

type ModalPortalProps = {
  children: ReactNode;
  /** When false, nothing is rendered (e.g. closed modal). Defaults to true. */
  open?: boolean;
};

function getPortalTarget(): HTMLElement {
  if (typeof document === "undefined") return document.body;
  return document.getElementById("modal-root") ?? document.body;
}

/** Renders children into #modal-root (inside workspace) so backdrop blur samples page content. */
export function ModalPortal({ children, open = true }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(getPortalTarget());
    setMounted(true);
  }, []);

  if (!open || !mounted || !target) return null;
  return createPortal(children, target);
}
