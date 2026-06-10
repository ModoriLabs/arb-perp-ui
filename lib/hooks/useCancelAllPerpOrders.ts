"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type {
  CancelAllPerpOrdersRequest,
  CancelAllPerpOrdersResponse,
} from "@/types"

export function useCancelAllPerpOrders() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request?: CancelAllPerpOrdersRequest) =>
      apiClient<CancelAllPerpOrdersResponse>("/perp/orders", {
        method: "DELETE",
        body: request ?? {},
        auth: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perpOrders", "history"] })
      queryClient.invalidateQueries({ queryKey: ["account"] })
    },
  })
}
