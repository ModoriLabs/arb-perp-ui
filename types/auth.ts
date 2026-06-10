export interface NonceResponse {
  nonce: string
  expires_in_seconds: number
}

export interface LoginRequest {
  address: string
  signature: string
  nonce: string
}

export interface LoginResponse {
  address: string
  access_expires_in: number
  refresh_expires_in: number
}

export interface RefreshResponse {
  address: string
  access_expires_in: number
  refresh_expires_in: number
}
