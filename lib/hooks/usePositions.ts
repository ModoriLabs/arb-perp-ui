"use client"

import { useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { AccountResponse, Position, PositionsResponse } from "@/types"
import { useAuthContext } from "../providers/AuthProvider"
import { useWebSocket } from "../providers/WebSocketProvider"
import { useAccountStore } from "../stores/useAccountStore"

/**
 * Derives position data from the /account endpoint.
 * The old /positions route is replaced by the unified /account response.
 */
export function usePositions() {
  const { isAuthenticated } = useAuthContext()
  const queryClient = useQueryClient()
  const { subscribe } = useWebSocket()
  const accountIndex = useAccountStore((s) => s.account?.index ?? null)

  // Invalidate on WS updates (throttled: max once per second)
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (accountIndex == null) return

    const invalidate = () => {
      if (throttleRef.current) return
      queryClient.invalidateQueries({ queryKey: ["account"] })
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null
      }, 1000)
    }

    const unsubscribe = subscribe(
      `account_all/${accountIndex}`,
      (raw: unknown) => {
        const msg = raw as Record<string, unknown>
        // Broad filter: covers positions, trades, liquidations, balance changes
        if (typeof msg.type === "string" && msg.type.startsWith("update/")) {
          invalidate()
        }
      }
    )

    return () => {
      unsubscribe()
      if (throttleRef.current) clearTimeout(throttleRef.current)
    }
  }, [accountIndex, subscribe, queryClient])

  const { data: accountData, ...rest } = useQuery({
    queryKey: ["account"],
    queryFn: () => apiClient<AccountResponse>("/account", { auth: true }),
    enabled: isAuthenticated,
    staleTime: 2000,
  })

  const data = useMemo<PositionsResponse | undefined>(() => {
    const account = accountData?.accounts?.[0]

    if (!account) return undefined

    const positions: Position[] = account.positions
      .filter((p) => p.position !== "0" && p.position !== "0.00000")
      .map((p) => {
        const unrealizedPnl = parseFloat(p.unrealized_pnl) || 0
        const margin = parseFloat(p.allocated_margin) || 0
        const roe = margin > 0 ? (unrealizedPnl / margin) * 100 : 0
        // mark_price: derive from position_value / size
        const size = parseFloat(p.position) || 0
        const positionValue = parseFloat(p.position_value) || 0
        const markPrice = size > 0 ? positionValue / size : 0

        return {
          id: p.market_id,
          market: p.symbol,
          quote_asset_id: p.quote_asset_id,
          side: p.sign >= 0 ? ("Long" as const) : ("Short" as const),
          size: p.position,
          entry_price: p.avg_entry_price,
          mark_price: markPrice.toString(),
          margin: p.allocated_margin,
          leverage: p.initial_margin_fraction,
          unrealized_pnl: p.unrealized_pnl,
          roe: `${roe.toFixed(2)}%`,
          liquidation_price: p.liquidation_price,
          funding_pnl: p.funding_pnl,
          created_at: "",
        }
      })

    return { positions }
  }, [accountData])

  return { data, ...rest }
}
