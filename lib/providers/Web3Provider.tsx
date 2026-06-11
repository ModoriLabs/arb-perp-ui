"use client"

import { wagmiAdapter, projectId } from "@/lib/constants/wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { arbitrumSepolia } from "@reown/appkit/networks"
import React, { type ReactNode } from "react"
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi"

// Set up queryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status
          // Don't retry on auth errors or rate limits
          if (status === 401 || status === 403 || status === 429) return false
        }
        return failureCount < 2
      },
    },
  },
})

// Set up metadata
const metadata = {
  name: "appkit-example",
  description: "AppKit Example",
  url: "http://localhost:3000",
  icons: ["/favicon.ico"],
}

// Create the modal (side effect initializes AppKit)
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [arbitrumSepolia],
  defaultNetwork: arbitrumSepolia,
  metadata: metadata,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
})

function Web3Provider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  )

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default Web3Provider
