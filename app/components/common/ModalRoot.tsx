"use client";

/** Fixed mount point for portaled modals — sibling of sidebar + main so backdrop-filter blurs them. */
export function ModalRoot() {
  return (
    <div
      id="modal-root"
      className="pointer-events-none fixed inset-0 z-modal empty:hidden [&>*]:pointer-events-auto"
    />
  );
}
