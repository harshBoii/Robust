'use client';

import { motion } from 'framer-motion';

export default function ChatSessionLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-full min-h-[calc(100vh-3rem)] flex-1 flex-col items-center justify-center gap-2"
    >
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className="text-sm text-muted-foreground">Opening conversation…</p>
    </motion.div>
  );
}
