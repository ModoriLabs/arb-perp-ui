"use client"

import { useEffect } from "react"
import { useBlockNumber } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { usePendingDepositStore } from "@/lib/stores/usePendingDepositStore"

const REQUIRED_CONFIRMATIONS = 15
const MAX_AGE_MS = 5 * 60_000 // 5 minutes safety fallback

/**
 * Monitors pending deposits and auto-removes them after enough block confirmations.
 * Call this once in a top-level component (e.g. Header).
 */
export function usePendingDepositMonitor() {
  const deposits = usePendingDepositStore((s) => s.deposits)
  const removeDeposit = usePendingDepositStore((s) => s.removeDeposit)
  const queryClient = useQueryClient()

  const { data: currentBlock } = useBlockNumber({
    watch: deposits.length > 0,
  })

  useEffect(() => {
    if (!currentBlock || deposits.length === 0) return

    const now = Date.now()

    for (const deposit of deposits) {
      const blockConfirmed =
        Number(currentBlock) >= deposit.depositBlock + REQUIRED_CONFIRMATIONS
      const timeExpired = now - deposit.timestamp >= MAX_AGE_MS

      if (blockConfirmed || timeExpired) {
        removeDeposit(deposit.txHash)
        queryClient.invalidateQueries({ queryKey: ["account"] })
        queryClient.invalidateQueries({ queryKey: ["deposit-history"] })
      }
    }
  }, [currentBlock, deposits, removeDeposit, queryClient])
}
