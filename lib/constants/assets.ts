export const ASSET_IDS = {
  USD: 840,
  BTC: 3762,
  ETH: 3928,
  ARB: 11841,
} as const

export interface AssetMeta {
  /** Display symbol. */
  symbol: string
  /** Icon path under public/. */
  icon: string
}

const FALLBACK_ICON = "/icons/collateral_logos/arbitrum_logo.svg"

/**
 * Per-asset display metadata, keyed by asset_id.
 */
export const ASSET_META: Record<number, AssetMeta> = {
  840: { symbol: "USD", icon: "/icons/tokens/usdt.svg" },
  3762: { symbol: "BTC", icon: "/icons/tokens/btc.svg" },
  3928: { symbol: "ETH", icon: "/icons/tokens/eth.svg" },
  11841: { symbol: "ARB", icon: "/icons/collateral_logos/arbitrum_logo.svg" },
}

export function getAssetMeta(assetId: number): AssetMeta {
  return ASSET_META[assetId] ?? { symbol: "Unknown", icon: FALLBACK_ICON }
}

export function getAssetIcon(assetId: number): string {
  return ASSET_META[assetId]?.icon ?? FALLBACK_ICON
}
