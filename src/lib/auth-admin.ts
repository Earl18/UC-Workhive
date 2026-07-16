import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { Role } from "@/lib/types";

type DbClient = Prisma.TransactionClient | PrismaClient;

type AuthUserInput = {
  authUserId?: string | null;
  email: string;
  password: string;
  name: string;
  role: Role;
};

type AuthProfileInput = {
  authUserId?: string | null;
  email: string;
  name: string;
  role: Role;
};

type AuthUserRecord = {
  id: string;
  email: string;
};

const AUTH_INSTANCE_ID = "00000000-0000-0000-0000-000000000000";
const AUTH_APP_META = JSON.stringify({ provider: "email", providers: ["email"] });

function buildIdentityData(userId: string, email: string) {
  return JSON.stringify({
    sub: userId,
    email,
    email_verified: false,
    phone_verified: false,
  });
}

function buildUserMeta(name: string, role: Role) {
  return JSON.stringify({
    email_verified: true,
    name,
    role,
  });
}

export async function findAuthUserByEmail(tx: DbClient, email: string) {
  const rows = await tx.$queryRaw<AuthUserRecord[]>`
    SELECT "id"::text AS "id", "email"
    FROM auth.users
    WHERE lower("email") = lower(${email})
      AND "deleted_at" IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function findAuthUserById(tx: DbClient, authUserId: string) {
  const rows = await tx.$queryRaw<AuthUserRecord[]>`
    SELECT "id"::text AS "id", "email"
    FROM auth.users
    WHERE "id" = ${authUserId}::uuid
      AND "deleted_at" IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function upsertIdentity(tx: DbClient, authUserId: string, email: string) {
  const identityRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text AS "id"
    FROM auth.identities
    WHERE "user_id" = ${authUserId}::uuid
      AND "provider" = 'email'
    LIMIT 1
  `;

  const identityData = buildIdentityData(authUserId, email);

  if (identityRows[0]) {
    await tx.$executeRaw`
      UPDATE auth.identities
      SET
        "provider_id" = ${authUserId},
        "identity_data" = ${identityData}::jsonb,
        "updated_at" = NOW()
      WHERE "id" = ${identityRows[0].id}::uuid
    `;
    return;
  }

  await tx.$executeRaw`
    INSERT INTO auth.identities (
      "provider_id",
      "user_id",
      "identity_data",
      "provider",
      "last_sign_in_at",
      "created_at",
      "updated_at"
    ) VALUES (
      ${authUserId},
      ${authUserId}::uuid,
      ${identityData}::jsonb,
      'email',
      NULL,
      NOW(),
      NOW()
    )
  `;
}

export async function findAuthUsersByEmails(tx: DbClient, emails: string[]) {
  const normalizedEmails = Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
  if (normalizedEmails.length == 0) {
    return [] as AuthUserRecord[];
  }

  return tx.$queryRaw<AuthUserRecord[]>(Prisma.sql`
    SELECT "id"::text AS "id", lower("email") AS "email"
    FROM auth.users
    WHERE lower("email") IN (${Prisma.join(normalizedEmails)})
      AND "deleted_at" IS NULL
  `);
}

export async function createAuthUsersWithPassword(
  tx: DbClient,
  inputs: Array<AuthUserInput & { authUserId?: string | null }>,
) {
  if (inputs.length === 0) {
    return [] as AuthUserRecord[];
  }

  const rows = inputs.map((input) => {
    const id = input.authUserId ?? randomUUID();
    return {
      id,
      email: input.email,
      password: input.password,
      userMeta: buildUserMeta(input.name, input.role),
      identityData: buildIdentityData(id, input.email),
    };
  });

  const userValues = rows.map((row) => Prisma.sql`(
    ${AUTH_INSTANCE_ID}::uuid,
    ${row.id}::uuid,
    'authenticated',
    'authenticated',
    ${row.email},
    crypt(${row.password}, gen_salt('bf')),
    NOW(),
    ${AUTH_APP_META}::jsonb,
    ${row.userMeta}::jsonb,
    '',
    '',
    '',
    '',
    '',
    '',
    NOW(),
    NOW(),
    false,
    false
  )`);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO auth.users (
      "instance_id",
      "id",
      "aud",
      "role",
      "email",
      "encrypted_password",
      "email_confirmed_at",
      "raw_app_meta_data",
      "raw_user_meta_data",
      "email_change",
      "confirmation_token",
      "recovery_token",
      "email_change_token_new",
      "email_change_token_current",
      "reauthentication_token",
      "created_at",
      "updated_at",
      "is_sso_user",
      "is_anonymous"
    ) VALUES ${Prisma.join(userValues)}
  `);

  const identityValues = rows.map((row) => Prisma.sql`(
    ${row.id},
    ${row.id}::uuid,
    ${row.identityData}::jsonb,
    'email',
    NULL,
    NOW(),
    NOW()
  )`);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO auth.identities (
      "provider_id",
      "user_id",
      "identity_data",
      "provider",
      "last_sign_in_at",
      "created_at",
      "updated_at"
    ) VALUES ${Prisma.join(identityValues)}
  `);

  return rows.map((row) => ({ id: row.id, email: row.email }));
}

export async function createAuthUserWithPassword(tx: DbClient, input: AuthUserInput) {
  const authUserId = randomUUID();
  const userMeta = buildUserMeta(input.name, input.role);

  await tx.$executeRaw`
    INSERT INTO auth.users (
      "instance_id",
      "id",
      "aud",
      "role",
      "email",
      "encrypted_password",
      "email_confirmed_at",
      "raw_app_meta_data",
      "raw_user_meta_data",
      "email_change",
      "confirmation_token",
      "recovery_token",
      "email_change_token_new",
      "email_change_token_current",
      "reauthentication_token",
      "created_at",
      "updated_at",
      "is_sso_user",
      "is_anonymous"
    ) VALUES (
      ${AUTH_INSTANCE_ID}::uuid,
      ${authUserId}::uuid,
      'authenticated',
      'authenticated',
      ${input.email},
      crypt(${input.password}, gen_salt('bf')),
      NOW(),
      ${AUTH_APP_META}::jsonb,
      ${userMeta}::jsonb,
      '',
      '',
      '',
      '',
      '',
      '',
      NOW(),
      NOW(),
      false,
      false
    )
  `;

  await upsertIdentity(tx, authUserId, input.email);
  return { id: authUserId, email: input.email };
}

async function findExistingAuthUser(
  tx: DbClient,
  input: { authUserId?: string | null; email: string },
) {
  if (input.authUserId) {
    const byId = await findAuthUserById(tx, input.authUserId);
    if (byId) {
      return byId;
    }
  }

  return findAuthUserByEmail(tx, input.email);
}

export async function syncAuthUserProfile(tx: DbClient, input: AuthProfileInput) {
  const existing = await findExistingAuthUser(tx, input);
  if (!existing) {
    return null;
  }

  const userMeta = buildUserMeta(input.name, input.role);

  await tx.$executeRaw`
    UPDATE auth.users
    SET
      "email" = ${input.email},
      "raw_user_meta_data" = ${userMeta}::jsonb,
      "email_change" = '',
      "confirmation_token" = COALESCE("confirmation_token", ''),
      "recovery_token" = COALESCE("recovery_token", ''),
      "email_change_token_new" = COALESCE("email_change_token_new", ''),
      "email_change_token_current" = COALESCE("email_change_token_current", ''),
      "reauthentication_token" = COALESCE("reauthentication_token", ''),
      "phone_change_token" = COALESCE("phone_change_token", ''),
      "updated_at" = NOW()
    WHERE "id" = ${existing.id}::uuid
  `;

  await upsertIdentity(tx, existing.id, input.email);
  return existing;
}

export async function ensureAuthUserWithPassword(tx: DbClient, input: AuthUserInput) {
  const existing = await findExistingAuthUser(tx, input);
  if (!existing) {
    return createAuthUserWithPassword(tx, input);
  }

  const userMeta = buildUserMeta(input.name, input.role);

  await tx.$executeRaw`
    UPDATE auth.users
    SET
      "email" = ${input.email},
      "encrypted_password" = crypt(${input.password}, gen_salt('bf')),
      "email_confirmed_at" = COALESCE("email_confirmed_at", NOW()),
      "raw_app_meta_data" = ${AUTH_APP_META}::jsonb,
      "raw_user_meta_data" = ${userMeta}::jsonb,
      "email_change" = '',
      "confirmation_token" = COALESCE("confirmation_token", ''),
      "recovery_token" = COALESCE("recovery_token", ''),
      "email_change_token_new" = COALESCE("email_change_token_new", ''),
      "email_change_token_current" = COALESCE("email_change_token_current", ''),
      "reauthentication_token" = COALESCE("reauthentication_token", ''),
      "phone_change_token" = COALESCE("phone_change_token", ''),
      "updated_at" = NOW(),
      "deleted_at" = NULL
    WHERE "id" = ${existing.id}::uuid
  `;

  await upsertIdentity(tx, existing.id, input.email);
  return existing;
}



