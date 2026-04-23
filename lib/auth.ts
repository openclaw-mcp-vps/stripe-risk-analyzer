import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const ACCESS_COOKIE_NAME = "sra_access";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecretKeyBytes(): Uint8Array {
  const secret =
    process.env.ACCESS_TOKEN_SECRET ?? "replace-this-in-production-with-a-random-secret";
  return new TextEncoder().encode(secret);
}

export interface AccessSession {
  email: string;
  plan: "pro";
}

export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_TTL_SECONDS
};

export async function createAccessToken(email: string): Promise<string> {
  return new SignJWT({ email, plan: "pro" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKeyBytes());
}

export async function verifyAccessToken(token: string): Promise<AccessSession | null> {
  try {
    const result = await jwtVerify(token, getSecretKeyBytes());
    const payload = result.payload as { email?: unknown; plan?: unknown };

    if (typeof payload.email !== "string") {
      return null;
    }

    return {
      email: payload.email.toLowerCase(),
      plan: "pro"
    };
  } catch {
    return null;
  }
}

export async function getAccessSessionFromRequest(
  request: NextRequest
): Promise<AccessSession | null> {
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}

export async function getAccessSessionFromCookies(): Promise<AccessSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}
