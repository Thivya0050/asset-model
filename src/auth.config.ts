import type { NextAuthConfig } from "next-auth";
import type { AppRole } from "@/lib/roles";

const EIGHT_HOURS = 8 * 60 * 60;

/**
 * Edge-safe Auth.js config (no Prisma / bcrypt).
 * Full Credentials provider is attached in `src/auth.ts` (Node runtime).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
    maxAge: EIGHT_HOURS,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role as AppRole;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppRole;
        session.user.name = (token.name as string) ?? "";
        session.user.email = (token.email as string) ?? "";
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
