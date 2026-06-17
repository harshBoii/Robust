import Image from 'next/image';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={ROBUST_DNA.markLight}
      alt=""
      width={24}
      height={24}
      className={className}
      aria-hidden
    />
  );
}
