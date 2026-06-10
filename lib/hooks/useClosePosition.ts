"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { ClosePositionRequest, ClosePositionResponse } from "@/types"

export function useClosePosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ClosePositionRequest) =>
      apiClient<ClosePositionResponse>("/perp/order", {
        method: "POST",
        body: request,
        auth: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] })
      queryClient.invalidateQueries({ queryKey: ["perpOrders", "open"] })
      queryClient.invalidateQueries({ queryKey: ["perpOrders", "history"] })
    },
  })
}
