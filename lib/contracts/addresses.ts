import { sepolia, arbitrumSepolia } from "viem/chains"
import { ASSET_IDS } from "@/lib/constants/assets"

export interface ChainContracts {
  elysiaPerp: `0x${string}`
  collateralToken: `0x${string}`
}

// Typed as `Record<number, ChainContracts>` so callers can index by a
// dynamic chain id from `useChainId()`. With `as const` TS narrows the
// keys to literals and `CONTRACTS[number]` becomes an error.
export const CONTRACTS: Record<number, ChainContracts> = {
  [sepolia.id]: {
    elysiaPerp: "0x4dbaAcb29928F0C324C836141742a33A28F66778",
    // EL MockToken. Kept as the default/back-compat collateral token address.
    collateralToken: "0x3080B6C3AeE68fa83Ec02f749BA8c4D0a963A7Dc",
  },
  [arbitrumSepolia.id]: {
    // ElysiaPerp UUPS proxy on Arbitrum Sepolia. Do not call the
    // implementation directly (0xEFf8…6E2) — always go through the proxy.
    elysiaPerp: "0xD387fF3de9Ebed5B5aF955d40Bbb245f91a6227c",
    // MockARB — the only deposit collateral on this chain today.
    collateralToken: "0x8e542B665DBa78b1313A4418281962d7190405E8",
  },
}

export interface CollateralToken {
  assetId: number
  address: `0x${string}`
}

/**
 * Deposit/mint-able collateral tokens per chain (multi-token, ELP-133).
 * Order here drives the default selection in the deposit/mint modals.
 */
export const COLLATERAL_TOKENS: Record<number, CollateralToken[]> = {
  [sepolia.id]: [
    { assetId: ASSET_IDS.EL, address: CONTRACTS[sepolia.id].collateralToken },
    {
      assetId: ASSET_IDS.USDT,
      address: "0xA82Ac14ac0625461B2A2F00B18Af7b13e00af318" as `0x${string}`,
    },
  ],
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
  [ASSET_IDS.EL]: sepolia.id,
  [ASSET_IDS.USDT]: sepolia.id,
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
 * address, searching across *every* registered chain.
 *
 * The deposit history endpoint returns `token_address` with no chain
 * hint, and a single user can have deposited on multiple chains
 * (EL/USDT on Sepolia, ARB on Arbitrum Sepolia, …). Looking up against
 * one hardcoded chain (the old `getAssetIdByTokenAddress(sepolia.id, …)`
 * pattern) misses every deposit made on the other chain and silently
 * falls back to the wrong symbol — e.g. ARB deposits being rendered as
 * "EL$" in the deposits table.
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
  [sepolia.id]:
    sepolia.blockExplorers?.default?.url ?? "https://sepolia.etherscan.io",
  [arbitrumSepolia.id]:
    arbitrumSepolia.blockExplorers?.default?.url ??
    "https://sepolia.arbiscan.io",
}

/**
 * Build a "View tx" link for the given chain. Falls back to the Sepolia
 * explorer when the chain is unknown — the link will 404 on the wrong
 * network but at least the user gets *some* affordance instead of a
 * broken `href`. Until this helper existed every history row hard-coded
 * `https://sepolia.etherscan.io/tx/${tx_hash}`, which silently sent ARB
 * deposit/withdraw clicks to a Sepolia search that never resolved.
 */
export function getExplorerTxUrl(
  chainId: number | undefined,
  txHash: string
): string {
  const base =
    (chainId != null && EXPLORER_BASE_URL[chainId]) ??
    EXPLORER_BASE_URL[sepolia.id]
  return `${base}/tx/${txHash}`
}
