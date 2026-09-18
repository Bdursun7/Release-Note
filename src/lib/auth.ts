import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { githubConfigured, githubOAuthScopes } from "@/lib/github";
import { demoAuthEnabled } from "@/lib/flags";

export { demoAuthEnabled };

async function createIsolatedDemoUser() {
  const id = crypto.randomUUID();
  return prisma.user.create({
    data: {
      email: `demo-${id}@shipbrief.local`,
      name: "Demo",
      isDemo: true,
      githubLogin: `demo-${id.slice(0, 8)}`,
    },
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
                scope: githubOAuthScopes(),
              },
            },
          }),
        ]
      : []),
    ...(demoAuthEnabled()
      ? [
          CredentialsProvider({
            id: "demo",
            name: "Demo",
            credentials: {
              intent: { label: "intent", type: "text" },
            },
            async authorize() {
              if (!demoAuthEnabled()) return null;
              const user = await createIsolatedDemoUser();
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: null,
              };
            },
          }),
        ]
      : []),
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
        token.githubLogin = typeof user.email === "string" ? user.email : "demo";
        delete token.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string | undefined;
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

/** GitHub user-to-server token from the encrypted JWT — never copied onto the session. */
export async function getGithubAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  if (!cookieHeader) return undefined;
  const token = await getToken({
    req: {
      headers: { cookie: cookieHeader },
      cookies: Object.fromEntries(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value])),
    } as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  return typeof token?.accessToken === "string" ? token.accessToken : undefined;
}

declare module "next-auth" {
  interface Session {
    userId?: string;
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
