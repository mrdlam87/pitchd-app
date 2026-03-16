import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Prisma, no Node.js-only modules.
// Used by middleware. Full auth.ts adds the Prisma callbacks on top.
export const authConfig: NextAuthConfig = {
  providers: [Google],
  callbacks: {
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
};
