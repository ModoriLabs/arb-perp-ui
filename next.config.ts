import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/candle-api/:path*",
        destination: `${process.env.NEXT_PUBLIC_CANDLE_API_URL || "https://ohlcv-server-dev.up.railway.app"}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
