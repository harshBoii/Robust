import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

type Props = { className?: string };

const LoginBottomAnimation = ({ className }: Props) => {
  return (
    <DotLottieReact
      className={className ?? 'h-full w-full'}
      src="https://lottie.host/4d6cdd8c-5527-415c-af73-06cb3a33f589/g6bG2S8WZj.lottie"
      loop
      autoplay
    />
  );
};

export default LoginBottomAnimation;