import { cookieStorage, createStorage } from "@wagmi/core"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { defineChain } from "viem"

export const projectId = "4904537e8592e7bd77c13800298adf15"

if (!projectId) {
  throw new Error("Project ID is not defined")
}

export const arbitrumSepolia = /*#__PURE__*/ defineChain({
  id: 421_614,
  name: "Arbitrum Sepolia",
  blockTime: 250,
  nativeCurrency: {
    name: "Arbitrum Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://arb-sepolia.g.alchemy.com/v2/Cm9b86CxcTnfyKuiOCxDA"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://sepolia.arbiscan.io",
      apiUrl: "https://api-sepolia.arbiscan.io/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 81930,
    },
  },
  testnet: true,
})

// Arbitrum Sepolia only — the deposit/mint flow uses MockARB as the
// single collateral rail.
//
// Typed as a mutable array (not `as const`) because WagmiAdapter and
// AppKit expect `AppKitNetwork[]`.
export const networks = [arbitrumSepolia]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
})

export const config = wagmiAdapter.wagmiConfig
