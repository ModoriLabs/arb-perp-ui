"use client"

import { useEffect, useRef } from "react"
import { usePositions } from "@/lib/hooks/usePositions"
import { usePositionStore } from "@/lib/stores/usePositionStore"

/**
 * Syncs React Query positions data into the Zustand PositionStore.
 * Only updates when position list actually changes (ignores PnL fluctuations).
 */
export function usePositionSync() {
  const { data: positionsData } = usePositions()
  const prevKeyRef = useRef<string>("")

  useEffect(() => {
    const positions = positionsData?.positions ?? []
    // Only update store when positions structurally change (not just PnL)
    const key = positions
      .map(
        (p) => `${p.market}:${p.side}:${p.size}:${p.entry_price}:${p.margin}`
      )
      .join("|")

    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key
      usePositionStore.getState().setPositions(positions)
    }
  }, [positionsData])
}
