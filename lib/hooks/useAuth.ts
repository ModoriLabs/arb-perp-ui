"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConnection, useSignTypedData, useDisconnect } from "wagmi"
import { apiClient } from "@/lib/api/client"
import { useAuthContext } from "@/lib/providers/AuthProvider"
import {
  EIP712_DOMAIN,
  LOGIN_TYPES,
  type LoginMessage,
} from "@/lib/constants/eip712"
import type { NonceResponse, LoginRequest, LoginResponse } from "@/types"

// Check if error is user rejection (cancelled signature)
function isUserRejection(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes("rejected") ||
      message.includes("denied") ||
      message.includes("cancelled") ||
      message.includes("user refused")
    )
  }
  return false
}

const API_URL = "/api" // Proxied through Next.js rewrites

export function useAuth() {
  const account = useConnection()
  const address = account.address
  const isConnected = account.status === "connected"
  const signTypedDataAsync = useSignTypedData()
  const disconnect = useDisconnect()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const {
    isAuthenticated,
    setAuthenticated,
    clearAuth,
    accountSwitched,
    clearAccountSwitched,
    isRefreshing,
    isAuthReady,
  } = useAuthContext()

  const loginMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Wallet not connected")
      }

      // 1. Get nonce from backend
      const { nonce } = await apiClient<NonceResponse>(
        `/auth/nonce?address=${address}`
      )

      // 2. Prepare message for signing (user, nonce)
      const message: LoginMessage = {
        user: address,
        nonce,
      }

      // 3. Sign with EIP-712. Domain deliberately omits `chainId` —
      // login is address ownership proof and the same EOA is valid on
      // every chain; the server-side domain mirrors this field set.
      // Including chainId here would re-introduce the ArbSep → Sepolia
      // domain-separator divergence that bricks login on non-primary
      // chains.
      const signature = await signTypedDataAsync.mutateAsync({
        account: address,
        domain: EIP712_DOMAIN,
        types: LOGIN_TYPES,
        primaryType: "LoginMessage",
        message,
      })

      // 4. Send to backend - server sets httpOnly cookies
      const loginRequest: LoginRequest = {
        address,
        signature,
        nonce,
      }

      const response = await apiClient<LoginResponse>("/auth/login", {
        method: "POST",
        body: loginRequest,
        auth: true, // Include credentials so server can set cookies
      })

      // 5. Update auth state (cookies already set by server)
      setAuthenticated(true)

      return response
    },
    onError: (error) => {
      console.error("[useAuth] Login error:", error)

      if (isUserRejection(error)) {
        console.error(
          "[useAuth] User rejected signature - disconnecting wallet"
        )
        disconnect.mutate()
        setShowAuthModal(true)
      }
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Call logout endpoint to clear cookies
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      clearAuth()
    },
    onError: (error) => {
      console.error("[useAuth] Logout error:", error)
    },
  })

  return {
    // State
    isConnected,
    isAuthenticated,
    address,
    accountSwitched,
    isRefreshing,
    isAuthReady,
    showAuthModal,

    // Actions
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    signOut: logoutMutation.mutate,
    signOutAsync: logoutMutation.mutateAsync,
    clearAccountSwitched,
    setShowAuthModal,

    // Mutation state
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    isLoggingOut: logoutMutation.isPending,
  }
}
