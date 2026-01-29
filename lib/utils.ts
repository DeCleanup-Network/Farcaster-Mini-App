import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format fee in wei as ETH string, trimming trailing zeros (e.g. 0.00001000 → 0.00001) */
export function formatFeeEth(feeWei: bigint): string {
  const s = (Number(feeWei) / 1e18).toFixed(8)
  return s.replace(/\.?0+$/, '')
}
