import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import sql from "@/lib/db";

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
) {
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

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;
    return refreshed as { access_token: string; expires_in: number; refresh_token?: string };
  } catch (error) {
    console.error("Failed to refresh Google extras token", error);
    return null;
  }
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
          INSERT INTO users (google_sub, email)
          VALUES (${profile.sub}, ${profile.email as string})
          ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email
          RETURNING id
        `;
        token.appUserId = rows[0].id as number;
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
        if (refreshed) {
          token.extrasAccessToken = refreshed.access_token;
          token.extrasExpiresAt = Math.floor(Date.now() / 1000 + refreshed.expires_in);
          if (refreshed.refresh_token) token.extrasRefreshToken = refreshed.refresh_token;
          delete token.extrasError;
        } else {
          token.extrasError = "RefreshTokenError";
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
