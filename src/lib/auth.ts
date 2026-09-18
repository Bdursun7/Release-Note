import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { githubConfigured } from "@/lib/github";

const DEMO_EMAIL = "demo@shipbrief.local";

async function upsertDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { isDemo: true, name: "Demo" },
    create: { email: DEMO_EMAIL, name: "Demo", isDemo: true, githubLogin: "demo" },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/" },
  providers: [
    ...(githubConfigured()
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
            authorization: {
              params: {
                scope: process.env.GITHUB_SCOPE || "read:user repo",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "demo",
      name: "Demo",
      credentials: {
        intent: { label: "intent", type: "text" },
      },
      async authorize() {
        const user = await upsertDemoUser();
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "github") {
        const login =
          profile && typeof profile === "object" && "login" in profile
            ? String((profile as { login?: string }).login || "")
            : "";
        const githubId = String(account.providerAccountId);
        const email = token.email || user?.email || null;
        const dbUser = await prisma.user.upsert({
          where: { githubId },
          update: {
            name: user?.name || token.name,
            email,
            image: user?.image || (token.picture as string | undefined),
            githubLogin: login,
            isDemo: false,
          },
          create: {
            githubId,
            githubLogin: login,
            name: user?.name || login,
            email,
            image: user?.image,
            isDemo: false,
          },
        });
        token.userId = dbUser.id;
        token.accessToken = account.access_token;
        token.githubLogin = login;
        token.isDemo = false;
      }
      if (account?.provider === "demo" && user?.id) {
        token.userId = user.id;
        token.isDemo = true;
        token.githubLogin = "demo";
        token.accessToken = undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string | undefined;
      session.accessToken = token.accessToken as string | undefined;
      session.isDemo = Boolean(token.isDemo);
      session.githubLogin = token.githubLogin as string | undefined;
      if (session.user) {
        session.user.name = session.user.name || (token.githubLogin as string) || "User";
      }
      return session;
    },
  },
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;
  return session;
}

declare module "next-auth" {
  interface Session {
    userId?: string;
    accessToken?: string;
    isDemo?: boolean;
    githubLogin?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    isDemo?: boolean;
    githubLogin?: string;
  }
}
