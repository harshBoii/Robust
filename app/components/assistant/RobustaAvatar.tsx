'use client';

import Image from 'next/image';

export function RobustaAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 36 : 24;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full shadow-sm"
      style={{ width: dim, height: dim }}
    >
      <Image
        src="/mascot/Robust.png"
        alt="Miss Robusta"
        width={dim}
        height={dim}
        className="h-full w-full object-cover"
        unoptimized
      />
    </div>
  );
}
