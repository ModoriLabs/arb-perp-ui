export const ASSET_IDS = {
  USD: 840,
  BTC: 3762,
  ETH: 3928,
  USDT: 825,
  EL: 5382,
  ARB: 11841,
} as const

export interface AssetMeta {
  /** Display symbol (perp-collateral tokens keep the trailing "$"). */
  symbol: string
  /** Icon path under public/. */
  icon: string
}

const FALLBACK_ICON = "/icons/tokens/el.svg"

/**
 * Per-asset display metadata, keyed by asset_id. Multi-token (ELP-133) added
 * USDT (825). Note: 825 is USDT and 5382 is EL — they are distinct tokens.
 */
export const ASSET_META: Record<number, AssetMeta> = {
  840: { symbol: "USD", icon: "/icons/tokens/usdt.svg" },
  825: { symbol: "USDT", icon: "/icons/tokens/usdt.svg" },
  3762: { symbol: "BTC", icon: "/icons/tokens/btc.svg" },
  3928: { symbol: "ETH", icon: "/icons/tokens/eth.svg" },
  5382: { symbol: "EL$", icon: "/icons/tokens/el.svg" },
  11841: { symbol: "ARB", icon: "/icons/collateral_logos/arbitrum_logo.svg" },
}

export function getAssetMeta(assetId: number): AssetMeta {
  return ASSET_META[assetId] ?? { symbol: "Unknown", icon: FALLBACK_ICON }
}

export function getAssetIcon(assetId: number): string {
  return ASSET_META[assetId]?.icon ?? FALLBACK_ICON
}
