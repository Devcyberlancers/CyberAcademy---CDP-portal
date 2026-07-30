"use client";

import { useState } from "react";

type ActionButtonProps = {
  children: React.ReactNode;
  className?: string;
  message: string;
};

export function ActionButton({ children, className, message }: ActionButtonProps) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        setDone(true);
        window.setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? message : children}
    </button>
  );
}
