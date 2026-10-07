import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import sql from "@/lib/db";

type RefreshResult =
  | { ok: true; accessToken: string; expiresAt: number; refreshToken?: string }
  // permanent = Google rejected the refresh token itself (expired/revoked), so
  // retrying is pointless and the user has to reconnect. Anything else
  // (network blip, 5xx) is transient and worth trying again next request.
  | { ok: false; permanent: boolean };

const PERMANENT_REFRESH_ERRORS = new Set(["invalid_grant", "invalid_client", "unauthorized_client"]);

async function requestGoogleTokenRefresh(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<RefreshResult> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      console.error("Failed to refresh Google extras token", body);
      return { ok: false, permanent: PERMANENT_REFRESH_ERRORS.has(body?.error) };
    }
    return {
      ok: true,
      accessToken: body.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + body.expires_in),
      refreshToken: body.refresh_token,
    };
  } catch (error) {
    console.error("Failed to refresh Google extras token", error);
    return { ok: false, permanent: false };
  }
}

// auth() runs the jwt callback on every call, and a server render calls it
// several times — but a refreshed token can't be written back to the cookie
// from a server component, so without this every one of those calls would
// hit Google's token endpoint again. Reusing a refresh for 30 minutes (the
// access token lives 60) keeps that to about one round trip per instance.
const REFRESH_REUSE_MS = 30 * 60 * 1000;
const recentRefreshes = new Map<string, { at: number; result: Promise<RefreshResult> }>();

function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string) {
  const cached = recentRefreshes.get(refreshToken);
  if (cached && Date.now() - cached.at < REFRESH_REUSE_MS) return cached.result;

  const result = requestGoogleTokenRefresh(refreshToken, clientId, clientSecret);
  recentRefreshes.set(refreshToken, { at: Date.now(), result });
  void result.then((r) => {
    if (!r.ok && !r.permanent) recentRefreshes.delete(refreshToken);
  });
  return result;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      // Primary sign-in, used by everyone. Basic scopes only — non-sensitive,
      // so Google requires no verification review, no user cap, no token expiry.
      authorization: { params: { scope: "openid email profile" } },
    }),
    Google({
      // Owner-only bonus connection: family calendar sync + Gmail receipt import.
      // Stays in Google's "Testing" publishing status with only the owner's
      // account added as a test user — never submitted for verification.
      id: "google-extras",
      clientId: process.env.AUTH_GOOGLE_EXTRAS_ID,
      clientSecret: process.env.AUTH_GOOGLE_EXTRAS_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Runs on every fresh sign-in, regardless of which provider — the
      // Google account (and its stable "sub") is the same either way, and
      // NextAuth doesn't otherwise guarantee appUserId survives on the token
      // across a second, different-provider sign-in while already signed in.
      if (account && profile?.sub) {
        const rows = await sql`
          INSERT INTO users (google_sub, email, name)
          VALUES (${profile.sub}, ${profile.email as string}, ${(profile.name as string) ?? null})
          ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name
          RETURNING id
        `;
        token.appUserId = rows[0].id as number;

        // If the owner invited this email as a shared viewer, link it to
        // their new/existing users row now — flips their status from
        // Pending to Active. No-op if this email was never invited.
        await sql`
          UPDATE shared_viewers SET user_id = ${token.appUserId}
          WHERE email = ${(profile.email as string).toLowerCase()}
        `;
      }

      if (account?.provider === "google") {
        return token;
      }

      if (account?.provider === "google-extras") {
        token.extrasAccessToken = account.access_token;
        token.extrasRefreshToken = account.refresh_token;
        token.extrasExpiresAt = account.expires_at;
        delete token.extrasError;
        return token;
      }

      // No fresh sign-in this request — refresh the extras token if it's due.
      if (
        token.extrasRefreshToken &&
        (!token.extrasExpiresAt || Date.now() >= (token.extrasExpiresAt as number) * 1000)
      ) {
        const refreshed = await refreshGoogleToken(
          token.extrasRefreshToken as string,
          process.env.AUTH_GOOGLE_EXTRAS_ID!,
          process.env.AUTH_GOOGLE_EXTRAS_SECRET!,
        );
        if (refreshed.ok) {
          token.extrasAccessToken = refreshed.accessToken;
          token.extrasExpiresAt = refreshed.expiresAt;
          if (refreshed.refreshToken) token.extrasRefreshToken = refreshed.refreshToken;
          delete token.extrasError;
        } else if (refreshed.permanent) {
          // Drop the dead access token too — leaving it behind is what made
          // the app keep reporting "connected" while every Google call failed.
          token.extrasError = "RefreshTokenError";
          delete token.extrasAccessToken;
          delete token.extrasExpiresAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.appUserId = token.appUserId as number | undefined;
      session.extrasAccessToken = token.extrasAccessToken as string | undefined;
      session.extrasError = token.extrasError as string | undefined;
      return session;
    },
  },
});
