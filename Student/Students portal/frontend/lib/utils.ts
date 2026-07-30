import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyLakhs(value: number) {
  return `INR ${value.toFixed(value % 1 ? 1 : 0)} LPA`;
}
