"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { useAuthContext } from "@/lib/providers/AuthProvider"
import type { WithdrawalHistoryResponse } from "@/types"

const PAGE_SIZE = 20

export function useWithdrawalHistory() {
  const { isAuthenticated } = useAuthContext()

  const query = useInfiniteQuery({
    queryKey: ["withdrawal-history"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (pageParam) params.set("from_id", String(pageParam))
      return apiClient<WithdrawalHistoryResponse>(
        `/account/withdrawals?${params}`,
        { auth: true }
      )
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      const withdrawals = lastPage.withdrawals
      if (withdrawals.length < PAGE_SIZE) return undefined
      return withdrawals[withdrawals.length - 1].id
    },
    enabled: isAuthenticated,
    // Poll every 5s while there are pending/submitted withdrawals
    refetchInterval: (query) => {
      const hasPending = query.state.data?.pages.some((page) =>
        page.withdrawals.some(
          (w) =>
            w.status === "pending" ||
            w.status === "pending_approval" ||
            w.status === "submitted"
        )
      )
      return hasPending ? 5000 : false
    },
  })

  return query
}
