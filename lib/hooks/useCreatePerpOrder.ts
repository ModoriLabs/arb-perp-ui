import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { PlacePerpOrderRequest, PlacePerpOrderResponse } from "@/types"

export function useCreatePerpOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PlacePerpOrderRequest) =>
      apiClient<PlacePerpOrderResponse>("/perp/order", {
        method: "POST",
        body: data,
        // Without auth:true the cookie isn't sent (and 401 auto-refresh is
        // skipped), so an expired access_token silently turns a real order
        // into "Failed" instead of recovering via /auth/refresh.
        auth: true,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orderbook", variables.market],
      })
      queryClient.invalidateQueries({
        queryKey: ["account"],
      })
      queryClient.invalidateQueries({
        queryKey: ["perpOrders", "open"],
      })
      queryClient.invalidateQueries({
        queryKey: ["perpOrders", "history"],
      })
      queryClient.invalidateQueries({
        queryKey: ["trades"],
      })
    },
  })
}
