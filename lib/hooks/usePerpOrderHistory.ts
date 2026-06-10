"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { PerpOrdersRawResponse, PerpOrdersResponse } from "@/types"
import { toPerpOrder } from "@/types"
import { useAuthContext } from "../providers/AuthProvider"
export function usePerpOrderHistory() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: ["perpOrders", "history"],
    queryFn: async (): Promise<PerpOrdersResponse> => {
      const raw = await apiClient<PerpOrdersRawResponse>("/perp/orders", {
        auth: true,
      })
      return { orders: raw.orders.map(toPerpOrder) }
    },
    enabled: isAuthenticated,
  })
}
