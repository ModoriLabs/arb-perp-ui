import { arbitrumSepolia } from "viem/chains"
import { ASSET_IDS } from "@/lib/constants/assets"

export interface ChainContracts {
  elysiaPerp: `0x${string}`
  collateralToken: `0x${string}`
}

// Typed as `Record<number, ChainContracts>` so callers can index by a
// dynamic chain id from `useChainId()`. With `as const` TS narrows the
// keys to literals and `CONTRACTS[number]` becomes an error.
export const CONTRACTS: Record<number, ChainContracts> = {
  [arbitrumSepolia.id]: {
    // ElysiaPerp UUPS proxy on Arbitrum Sepolia. Do not call the
    // implementation directly (0xEFf8…6E2) — always go through the proxy.
    elysiaPerp: "0xD387fF3de9Ebed5B5aF955d40Bbb245f91a6227c",
    // MockARB — the only deposit collateral.
    collateralToken: "0x8e542B665DBa78b1313A4418281962d7190405E8",
  },
}

export interface CollateralToken {
  assetId: number
  address: `0x${string}`
}

/**
 * Deposit/mint-able collateral tokens per chain.
 * Order here drives the default selection in the deposit/mint modals.
 */
export const COLLATERAL_TOKENS: Record<number, CollateralToken[]> = {
  [arbitrumSepolia.id]: [
    {
      assetId: ASSET_IDS.ARB,
      address: CONTRACTS[arbitrumSepolia.id].collateralToken,
    },
  ],
}

/**
 * Reverse map: which chain hosts a given collateral asset_id?
 * Used by the deposit/withdraw UI to switch the wallet to the right
 * network when the user selects a non-current-chain token.
 */
export const ASSET_ID_TO_CHAIN_ID: Record<number, number> = {
  [ASSET_IDS.ARB]: arbitrumSepolia.id,
}

export function getTokenAddress(
  chainId: number,
  assetId: number
): `0x${string}` | undefined {
  return COLLATERAL_TOKENS[chainId]?.find((t) => t.assetId === assetId)?.address
}

export function getAssetIdByTokenAddress(
  chainId: number,
  address: string
): number | undefined {
  const lower = address.toLowerCase()
  return COLLATERAL_TOKENS[chainId]?.find(
    (t) => t.address.toLowerCase() === lower
  )?.assetId
}

/**
 * Find a collateral token's `{ assetId, chainId }` from its raw contract
 * address, searching across every registered chain.
 */
export function findCollateralByAddress(
  address: string
): { assetId: number; chainId: number } | undefined {
  const lower = address.toLowerCase()
  for (const [chainIdStr, tokens] of Object.entries(COLLATERAL_TOKENS)) {
    const match = tokens.find((t) => t.address.toLowerCase() === lower)
    if (match) {
      return { assetId: match.assetId, chainId: Number(chainIdStr) }
    }
  }
  return undefined
}

/**
 * Map of chain id → block-explorer base URL. Sourced from viem's chain
 * configs so we stay aligned with whatever the wallet provider tells the
 * user; if viem ever ships an override we don't even need to touch this.
 */
const EXPLORER_BASE_URL: Record<number, string> = {
  [arbitrumSepolia.id]:
    arbitrumSepolia.blockExplorers?.default?.url ??
    "https://sepolia.arbiscan.io",
}

/**
 * Build a "View tx" link for the given chain. Falls back to the Arbitrum
 * Sepolia explorer when the chain is unknown.
 */
export function getExplorerTxUrl(
  chainId: number | undefined,
  txHash: string
): string {
  const base =
    (chainId != null && EXPLORER_BASE_URL[chainId]) ??
    EXPLORER_BASE_URL[arbitrumSepolia.id]
  return `${base}/tx/${txHash}`
}
