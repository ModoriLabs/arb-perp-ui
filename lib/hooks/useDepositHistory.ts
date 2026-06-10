"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { useAuthContext } from "@/lib/providers/AuthProvider"
import type { DepositHistoryResponse } from "@/types"

const PAGE_SIZE = 20

export function useDepositHistory() {
  const { isAuthenticated } = useAuthContext()

  return useInfiniteQuery({
    queryKey: ["deposit-history"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (pageParam) params.set("from_id", String(pageParam))
      return apiClient<DepositHistoryResponse>(`/account/deposits?${params}`, {
        auth: true,
      })
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      const deposits = lastPage.deposits
      if (deposits.length < PAGE_SIZE) return undefined
      return deposits[deposits.length - 1].id
    },
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const hasPending = query.state.data?.pages.some((page) =>
        page.deposits.some((d) => d.status === "pending")
      )
      return hasPending ? 5000 : false
    },
  })
}
