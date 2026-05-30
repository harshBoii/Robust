"use client";

import type { ReactNode } from "react";

type ModalBackdropProps = {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  contentClassName?: string;
  shellProps?: React.HTMLAttributes<HTMLDivElement>;
};

/** Frosted blur + bokeh scrim. Blur lives on a dedicated full-screen layer inside #modal-root. */
export function ModalBackdrop({
  children,
  onClose,
  className = "",
  contentClassName = "",
  shellProps,
}: ModalBackdropProps) {
  return (
    <div
      {...shellProps}
      className={`modal-overlay ${className}`}
      onClick={onClose}
      role={shellProps?.role ?? "presentation"}
    >
      <div className="modal-overlay__blur" aria-hidden />
      <div className="modal-overlay__bokeh" aria-hidden>
        <span className="modal-overlay__orb modal-overlay__orb--a" />
        <span className="modal-overlay__orb modal-overlay__orb--b" />
        <span className="modal-overlay__orb modal-overlay__orb--c" />
      </div>
      <div
        className={`modal-overlay__content ${contentClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
