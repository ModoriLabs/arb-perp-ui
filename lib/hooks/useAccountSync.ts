"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { useAuthContext } from "@/lib/providers/AuthProvider"
import { useAccountStore } from "@/lib/stores/useAccountStore"
import type { AccountResponse } from "@/types"

/**
 * Fetches /account once on auth and syncs the first account into Zustand.
 * Call this once at the top level (e.g., page.tsx).
 */
export function useAccountSync() {
  const { isAuthenticated } = useAuthContext()

  const { data } = useQuery({
    queryKey: ["account"],
    queryFn: () => apiClient<AccountResponse>("/account", { auth: true }),
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    useAccountStore.getState().setAccount(data?.accounts?.[0] ?? null)
  }, [data])
}
