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
  },
});
