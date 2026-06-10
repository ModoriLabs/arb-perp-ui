import { NextResponse } from "next/server"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { mainnet } from "viem/chains"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getRandomPrivateKey(): `0x${string}` {
  let randomPrivateKey = "0x"
  for (let j = 0; j < 64; j++) {
    randomPrivateKey += Math.floor(Math.random() * 16).toString(16)
  }
  return randomPrivateKey as `0x${string}`
}

export async function POST() {
  try {
    const privateKey = getRandomPrivateKey()

    const client = createWalletClient({
      chain: mainnet,
      transport: http("https://eth.llamarpc.com"),
    })

    const account = privateKeyToAccount(privateKey)

    // 1. Get nonce
    const nonceResponse = await fetch(
      `${API_URL}/auth/nonce?address=${account.address}`
    )
    const nonceData = await nonceResponse.json()

    // 2. Sign message
    const domain = {
      name: "ELSIA_PERP",
      version: "1",
      chainId: BigInt(11155111), // Sepolia
    }

    const message = {
      user: account.address,
      nonce: nonceData.nonce,
    }

    const types = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      LoginMessage: [
        { name: "user", type: "address" },
        { name: "nonce", type: "string" },
      ],
    } as const

    const signature = await client.signTypedData({
      account: account,
      domain,
      types,
      primaryType: "LoginMessage",
      message,
    })

    // 3. Login - 서버에서 쿠키를 받아옴
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: account.address,
        signature: signature,
        nonce: nonceData.nonce,
      }),
    })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text()
      return NextResponse.json(
        { error: "Login failed", details: errorText },
        { status: loginResponse.status }
      )
    }

    // 4. Extract cookies from response headers
    const setCookieHeaders = loginResponse.headers.getSetCookie?.() || []
    let cookies = ""

    if (setCookieHeaders.length > 0) {
      cookies = setCookieHeaders
        .map((cookie) => cookie.split(";")[0])
        .join("; ")
    } else {
      const setCookieHeader = loginResponse.headers.get("set-cookie")
      if (setCookieHeader) {
        const cookieStrings = Array.isArray(setCookieHeader)
          ? setCookieHeader
          : [setCookieHeader]

        cookies = cookieStrings.map((cookie) => cookie.split(";")[0]).join("; ")
      }
    }

    // 5. Deposit assets
    const depositAmount = 1000000000000
    const PERP_USD_ID = 5382

    const depositUrl = `${API_URL}/dev/account/deposit`

    await fetch(depositUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        asset_id: PERP_USD_ID,
        amount: depositAmount.toString(),
      }),
    })

    return NextResponse.json({
      success: true,
      address: account.address,
      cookies: cookies,
    })
  } catch (error) {
    console.error("Error creating account:", error)
    return NextResponse.json(
      {
        error: "Failed to create account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
