import { type TypedDataDomain } from "viem"

// Login is wallet-address ownership proof. Same EOA on every chain → login
// is chain-agnostic by nature. We deliberately omit `chainId` (and
// `verifyingContract`) from the domain so the signed message verifies
// regardless of which network the wallet happens to be on (Sepolia,
// Arbitrum Sepolia, …). Replay is already prevented by the one-shot,
// per-address nonce the server issues; cross-app separation is carried by
// the unique `name`. The server-side EIP-712 domain mirrors this exact
// field set — adding `chainId` here would diverge the domain separator
// and break login again.
export const EIP712_DOMAIN: TypedDataDomain = {
  name: "ELSIA_PERP",
  version: "1",
} as const

export const LOGIN_TYPES = {
  LoginMessage: [
    { name: "user", type: "address" },
    { name: "nonce", type: "string" },
  ],
} as const

export interface LoginMessage {
  user: `0x${string}`
  nonce: string
}
