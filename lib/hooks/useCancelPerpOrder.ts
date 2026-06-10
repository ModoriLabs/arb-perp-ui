"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { CancelPerpOrderRequest, CancelPerpOrderResponse } from "@/types"

export function useCancelPerpOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CancelPerpOrderRequest) =>
      apiClient<CancelPerpOrderResponse>("/perp/order", {
        method: "DELETE",
        body: request,
        auth: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perpOrders", "history"] })
      queryClient.invalidateQueries({ queryKey: ["account"] })
    },
  })
}
