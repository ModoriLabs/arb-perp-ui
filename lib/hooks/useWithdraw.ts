"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"

interface WithdrawRequest {
  asset_id: number // 출금할 토큰 (멀티토큰, ELP-133)
  amount: string // 사람이 읽는 숫자 (예: "100.5")
}

interface WithdrawResponse {
  id: number
  address: string
  asset_id: number
  amount: string
  route_type: string
  new_balance: string
}

export function useWithdraw() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ asset_id, amount }: WithdrawRequest) => {
      return apiClient<WithdrawResponse>("/account/withdraw", {
        method: "POST",
        auth: true,
        body: {
          asset_id,
          amount,
          route_type: "perp",
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["account"],
      })
      queryClient.invalidateQueries({
        queryKey: ["withdrawal-history"],
      })
    },
  })
}
