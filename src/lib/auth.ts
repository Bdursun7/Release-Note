import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { githubConfigured, githubOAuthScopes, validateGithubPat } from "@/lib/github";
import { applyGithubPatToJwt, buildClientSession } from "@/lib/auth-session";
import { demoAuthEnabled } from "@/lib/flags";

export { demoAuthEnabled };

async function upsertGithubUser(params: {
  githubId: string;
  login: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  return prisma.user.upsert({
    where: { githubId: params.githubId },
    update: {
      name: params.name || undefined,
      email: params.email,
      image: params.image || undefined,
      githubLogin: params.login,
      isDemo: false,
    },
    create: {
      githubId: params.githubId,
      githubLogin: params.login,
      name: params.name || params.login,
      email: params.email,
      image: params.image,
      isDemo: false,
    },
  });
}

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
  pages: { signIn: "/", error: "/" },
  providers: [
    ...(githubConfigured()
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID?.trim() || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || "",
            authorization: {
              params: {
                scope: githubOAuthScopes(),
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "github-pat",
      name: "GitHub PAT",
      credentials: {
        pat: { label: "Personal Access Token", type: "password" },
      },
      async authorize(credentials) {
        const pat = typeof credentials?.pat === "string" ? credentials.pat : "";
        const identity = await validateGithubPat(pat);
        if (!identity) return null;
        const dbUser = await upsertGithubUser({
          githubId: String(identity.id),
          login: identity.login,
          name: identity.name,
          email: identity.email,
          image: identity.avatarUrl,
        });
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.image,
          githubLogin: identity.login,
          pat,
        };
      },
    }),
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
        const dbUser = await upsertGithubUser({
          githubId,
          login,
          name: user?.name || token.name,
          email,
          image: user?.image || (token.picture as string | undefined),
        });
        token.userId = dbUser.id;
        token.accessToken = account.access_token;
        token.githubLogin = login;
        token.isDemo = false;
        delete token.pat;
      }
      if (account?.provider === "github-pat" && user?.id) {
        Object.assign(
          token,
          applyGithubPatToJwt(token, {
            id: user.id,
            githubLogin: user.githubLogin,
            pat: user.pat,
          }),
        );
        delete user.pat;
        delete token.pat;
      }
      if (account?.provider === "demo" && user?.id) {
        token.userId = user.id;
        token.isDemo = true;
        token.githubLogin = typeof user.email === "string" ? user.email : "demo";
        delete token.accessToken;
        delete token.pat;
      }
      return token;
    },
    async session({ session, token }) {
      return buildClientSession(session, token);
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

  interface User {
    githubLogin?: string;
    /** Transient PAT copied onto the JWT as accessToken — never on session. */
    pat?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    isDemo?: boolean;
    githubLogin?: string;
    pat?: string;
  }
}
