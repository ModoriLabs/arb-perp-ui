"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import type { AccountResponse } from "@/types"
import { useAuthContext } from "../providers/AuthProvider"

export function useAccount() {
  const { isAuthenticated } = useAuthContext()

  return useQuery({
    queryKey: ["account"],
    queryFn: () => apiClient<AccountResponse>("/account", { auth: true }),
    enabled: isAuthenticated,
  })
}
