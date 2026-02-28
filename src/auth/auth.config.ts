import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { MailService } from '../mail/mail.service';

type Role = 'admin' | 'patient' | 'doctor';

// Configurar pool de conexões para Neon
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is not defined.');
}

const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
const isHttpsFrontend = frontendUrl.startsWith('https://');

const pool = new Pool({ connectionString });

// Criar adapter do Prisma com driver Neon
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const mailService = new MailService();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  emailVerification: {
    expiresIn: 60 * 60, // 1 hora
    sendVerificationEmail: async ({ user, url, token }) => {
      await mailService.sendEmail(
        user.email,
        'Verificação de email',
        `Clique no link para verificar seu email: ${url}`,
      );
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
      sendChangeEmailConfirmation: async (
        { user, newEmail, url, token },
        request,
      ) => {
        await mailService.sendEmail(
          user.email, // Enviado para o email ATUAL
          'Confirmar mudança de email',
          `Clique no link para aprovar a mudança para ${newEmail}: ${url}`,
        );
      },
    },
  },
  additionalFields: {
    role: {
      type: 'string',
      required: true,
      defaultValue: 'patient',
      input: false,
    },
    imageCldPubId: {
      type: 'string',
      required: false,
      input: true,
    },
  },
  trustedOrigins: [frontendUrl],
  advanced: {
    defaultCookieAttributes: {
      // In localhost over HTTP, Secure + SameSite=None can block session cookies.
      sameSite: isHttpsFrontend ? 'None' : 'Lax',
      secure: isHttpsFrontend,
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  basePath: '/api/auth',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [
    admin({
      defaultRole: 'patient' as Role,
      adminRoles: ['admin'] as Role[],
    }),
  ],
  hooks: {},
});
