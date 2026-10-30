import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcrypt';
import * as schema from './schema.js';
import { databaseUrl } from './connection.js';

if (!process.env.ADMIN_PASSWORD) {
  throw new Error('Missing ADMIN_PASSWORD env var');
}

const db = drizzle(databaseUrl(), { schema });
const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

try {
  const createdUsers = await db.insert(schema.users).values({
    password: hashedPassword,
    username: 'överchefen',
    role: 'god',
  }).onConflictDoNothing({ target: schema.users.username }).returning({
    userId: schema.users.userId,
  });

  console.log(createdUsers.length ? 'Created initial admin user' : 'Initial admin user already exists; leaving it unchanged');
} catch (e: unknown) {
  console.error('failed to seed', e);
  process.exit(1);
}

process.exit(0);
