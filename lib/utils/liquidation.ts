import type { OrderBookDetail } from "@/types"
import { MARGIN_TICK, MMF_FRACTION } from "@/lib/constants/scaling"

/**
 * Resolve the maintenance margin fraction (0..1) for a market.
 * Prefers the per-market value the backend exposes on `OrderBookDetail`;
 * falls back to the global constant.
 */
export function mmfFractionOf(
  detail: OrderBookDetail | undefined | null
): number {
  const ticks = detail?.maintenance_margin_fraction
  if (ticks == null || ticks <= 0) return MMF_FRACTION
  return ticks / MARGIN_TICK
}

/**
 * Estimate liquidation price using the same formula the backend uses
 * (mirrors `common::position::margin`):
 *
 *   positionValue = size × markPrice
 *   mm            = positionValue × mmf
 *   Long  → entry - (margin - mm) / size
 *   Short → entry + (margin - mm) / size
 *
 * Returns 0 when inputs are invalid (size ≤ 0).
 *
 * For pre-trade previews use `markPrice = entryPrice` (the order's
 * intended fill price) — that's the best information we have before
 * the trade executes.
 */
export function computeLiquidationPrice(args: {
  side: "Long" | "Short"
  entryPrice: number
  size: number
  margin: number
  markPrice: number
  mmf: number
}): number {
  const { side, entryPrice, size, margin, markPrice, mmf } = args
  if (size <= 0) return 0
  const positionValue = size * markPrice
  const mm = positionValue * mmf
  const delta = (margin - mm) / size
  return side === "Long" ? entryPrice - delta : entryPrice + delta
}
