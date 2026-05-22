import type { IDataObject } from "n8n-workflow";
import type { Client, ClientConfig } from "pg";

export function postgresClientConfig(
  creds: IDataObject,
  databaseName: string
): ClientConfig {
  const sslMode = (creds.ssl as string) || "disable";
  const sslMap: Record<string, boolean | { rejectUnauthorized: boolean }> = {
    disable: false,
    allow: true,
    require: { rejectUnauthorized: false },
  };

  return {
    host: creds.host as string,
    port: creds.port as number,
    database: databaseName,
    user: creds.user as string,
    password: creds.password as string,
    ssl: sslMap[sslMode] as ClientConfig["ssl"],
    connectionTimeoutMillis: 60_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
}

export async function withPostgresClient<T>(
  creds: IDataObject,
  databaseName: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const { Client } = await import("pg");
  const client = new Client(postgresClientConfig(creds, databaseName));
  await client.connect();
  try {
    await client.query("SET statement_timeout = 0");
    await client.query("SET lock_timeout = 0");
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}
