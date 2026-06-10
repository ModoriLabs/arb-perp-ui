"use client"

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi"
import { parseUnits } from "viem"
import { CONTRACTS } from "@/lib/contracts/addresses"
import { getFeeOverrides } from "@/lib/contracts/gas"
import { MockTokenAbi } from "@/lib/contracts/abi/MockTokenAbi"
import { sepolia } from "viem/chains"

/**
 * Mints a MockToken to a wallet. Defaults to the EL collateral token on
 * Sepolia; pass `token` to mint another collateral (multi-token, ELP-133)
 * and `chainId` to mint on a different chain (multi-chain, ELP-230, e.g.
 * MockARB on Arbitrum Sepolia).
 *
 * `chainId` is also forwarded to the wagmi reads/writes so the hook works
 * even when the connected wallet is currently on a different network than
 * the token lives on — the UI is expected to call switchChain before
 * triggering `mint()`.
 */
export function useMintToken(
  token: `0x${string}` = CONTRACTS[sepolia.id].collateralToken,
  chainId: number = sepolia.id
) {
  const { mutate, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId,
  })
  const { data: decimals } = useReadContract({
    address: token,
    abi: MockTokenAbi,
    functionName: "decimals",
    chainId,
  })

  const mint = (to: `0x${string}`, amount: string) => {
    if (decimals == null) return
    const parsed = parseUnits(amount, decimals)
    mutate({
      address: token,
      abi: MockTokenAbi,
      functionName: "mint",
      args: [to, parsed],
      chainId,
      ...getFeeOverrides(chainId),
    })
  }

  return {
    mint,
    isPending,
    isConfirming,
    isSuccess,
    decimals,
    hash,
    error,
    reset,
  }
}
