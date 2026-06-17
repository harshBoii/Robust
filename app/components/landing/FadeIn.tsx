'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.28, 0.11, 0.32, 1] as const;

export function FadeIn({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.8, ease: EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
