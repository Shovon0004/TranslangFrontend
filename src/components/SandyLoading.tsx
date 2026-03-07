"use client";
import Lottie from "lottie-react";
import sandyAnimation from "../../public/lotti/Sandy Loading.json";

interface SandyLoadingProps {
  size?: number;
  className?: string;
}

export default function SandyLoading({ size = 160, className = "" }: SandyLoadingProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Lottie
        animationData={sandyAnimation}
        loop
        autoplay
        style={{ width: size, height: size }}
      />
    </div>
  );
}
