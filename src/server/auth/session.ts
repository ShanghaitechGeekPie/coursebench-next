import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: number;
  // Casdoor OAuth flow state
  casdoorOAuthState?: string;
  casdoorBindUserId?: number;
  casdoorReturnUrl?: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    return "dev-only-fallback-secret-at-least-32-chars!!";
  }
  return secret;
}

function getSessionOptions(): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: "session_id",
    cookieOptions: {
      httpOnly: process.env.NODE_ENV === "production",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function getUserId(): Promise<number | null> {
  const session = await getSession();
  return session.userId ?? null;
}

export async function requireUserId(): Promise<number> {
  const userId = await getUserId();
  if (!userId) {
    const { UserNotLogin } = await import("../errors");
    throw UserNotLogin();
  }
  return userId;
}
