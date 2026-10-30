/** Use a different database host without changing the shared connection URL. */
export function databaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DATABASE_URL env var');
  if (!process.env.DATABASE_HOST) return connectionString;

  const url = new URL(connectionString);
  url.hostname = process.env.DATABASE_HOST;
  return url.toString();
}
