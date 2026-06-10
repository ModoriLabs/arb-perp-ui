import { arbitrumSepolia } from "viem/chains"
import { parseGwei } from "viem"

/**
 * Per-chain EIP-1559 fee overrides for outbound writes.
 *
 * Arbitrum Sepolia: baseFee runs ~0.02 gwei and wagmi's default 1.2x
 * buffer ends up sitting only ~2000 wei above baseFee. The next block's
 * baseFee routinely climbs past that and the tx is rejected with
 * `max fee per gas less than block base fee`. We bump maxFeePerGas to
 * 0.1 gwei (~5x typical baseFee) — at this scale real-world gas cost is
 * still well below a cent, so over-paying is harmless.
 *
 * Sepolia (and any other chain) keeps wagmi's default estimator.
 */
export function getFeeOverrides(chainId: number): {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
} {
  if (chainId === arbitrumSepolia.id) {
    return {
      maxFeePerGas: parseGwei("0.1"),
      maxPriorityFeePerGas: 0n,
    }
  }
  return {}
}
