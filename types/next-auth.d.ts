import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    appUserId?: number;
    extrasAccessToken?: string;
    extrasError?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: number;
    extrasAccessToken?: string;
    extrasRefreshToken?: string;
    extrasExpiresAt?: number;
    extrasError?: string;
  }
}
