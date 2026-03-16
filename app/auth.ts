import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/generated/prisma/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;

      const googleId = account.providerAccountId;
      const email = user.email;

      if (!email || !googleId) return false;

      await prisma.user.upsert({
        where: { googleId },
        create: {
          email,
          name: user.name ?? null,
          avatarUrl: user.image ?? null,
          googleId,
          role: UserRole.user,
        },
        update: {
          email,
          name: user.name ?? null,
          avatarUrl: user.image ?? null,
        },
      });

      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
});
