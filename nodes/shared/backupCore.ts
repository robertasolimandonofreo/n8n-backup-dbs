import type { IDataObject } from "n8n-workflow";
import {
  backupContentType,
  backupDataExtension,
  compressBuffer,
  jsonToBuffer,
  resolveCompression,
} from "./backupCompression";
import { withPostgresClient } from "./postgresClient";
import { uploadRecordBatches } from "./backupSerialize";
import { ROW_BATCH_SIZE } from "./backupSummary";

export async function uploadToS3(
  s3Creds: IDataObject,
  key: string,
  body: Buffer | string,
  contentType = "application/octet-stream"
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  type S3StorageClass = import("@aws-sdk/client-s3").StorageClass;

  const client = new S3Client({
    region: s3Creds.region as string,
    credentials: {
      accessKeyId: s3Creds.accessKeyId as string,
      secretAccessKey: s3Creds.secretAccessKey as string,
      ...(s3Creds.sessionToken
        ? { sessionToken: s3Creds.sessionToken as string }
        : {}),
    },
  });

  const prefix = ((s3Creds.keyPrefix as string) || "").replace(/\/$/, "");
  const fullKey = prefix ? `${prefix}/${key}` : key;
  const storageClass: S3StorageClass =
    ((s3Creds.storageClass as string) || "STANDARD_IA") as S3StorageClass;

  await client.send(
    new PutObjectCommand({
      Bucket: s3Creds.bucket as string,
      Key: fullKey,
      Body: body,
      ContentType: contentType,
      StorageClass: storageClass,
    })
  );

  return `s3://${s3Creds.bucket as string}/${fullKey}`;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeBackupFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
}

export function buildBackupBaseName(
  options: IDataObject,
  suffix?: string
): string {
  const custom = sanitizeBackupFileName(
    ((options.nameBackup as string) || "").trim()
  );

  if (!custom) {
    return `${todayDate()}${suffix ? `_${suffix}` : ""}`;
  }

  return suffix ? `${custom}_${suffix}` : custom;
}

export function buildBackupFileName(
  options: IDataObject,
  extension: string,
  suffix?: string
): string {
  return `${buildBackupBaseName(options, suffix)}.${extension}`;
}

export function requireSpecificName(scope: string, name: string, label: string): string {
  if (scope !== "specific") return "";
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(`${label} is required when scope is set to a specific target`);
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB
// ─────────────────────────────────────────────────────────────────────────────

export async function backupMongoDB(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const { MongoClient } = await import("mongodb");

  const client = new MongoClient(creds.uri as string, {
    tls: (creds.tls as boolean) ?? false,
  });

  try {
    await client.connect();
    const compression = resolveCompression(options);
    const scope = (options.databaseScope as string) || "all";
    const specificDb = requireSpecificName(
      scope,
      (options.databaseName as string) || "",
      "Database name"
    );

    const dbNames: string[] =
      scope === "specific"
        ? [specificDb]
        : (await client.db("admin").admin().listDatabases()).databases
            .map((d: { name: string }) => d.name)
            .filter((n: string) => !["admin", "local", "config"].includes(n));

    const results: IDataObject[] = [];

    for (const dbName of dbNames) {
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      const baseName = buildBackupBaseName(
        options,
        dbNames.length > 1 ? dbName : undefined
      );
      const ext = backupDataExtension(compression);
      const exportedAt = new Date().toISOString();
      const uploads: IDataObject[] = [];

      for (const col of collections) {
        const cursor = db.collection(col.name).find({});
        let batch: unknown[] = [];
        let part = 0;

        const flushBatch = async (rows: unknown[]) => {
          part = await uploadRecordBatches(
            rows,
            {
              database: dbName,
              collection: col.name,
              exportedAt,
            },
            compression,
            async (body, partIndex, rowCount) => {
              const fileStem =
                partIndex > 1
                  ? `${col.name}_part${String(partIndex).padStart(4, "0")}`
                  : col.name;
              const key = `mongodb/${dbName}/${baseName}/${fileStem}.${ext}`;
              const s3Uri = await uploadToS3(
                s3Creds,
                key,
                body,
                backupContentType(compression)
              );
              uploads.push({
                collection: col.name,
                part: partIndex,
                s3Uri,
                sizeBytes: body.byteLength,
                rowCount,
              });
            },
            part
          );
        };

        for await (const doc of cursor) {
          batch.push(doc);
          if (batch.length >= ROW_BATCH_SIZE) {
            await flushBatch(batch);
            batch = [];
          }
        }

        await flushBatch(batch);
      }

      results.push({
        database: dbName,
        collections: collections.length,
        prefix: `mongodb/${dbName}/${baseName}/`,
        uploads,
        compression,
      });
    }

    return {
      success: true,
      engine: "mongodb",
      scope: (options.databaseScope as string) || "all",
      backups: results,
    };
  } finally {
    await client.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────

export async function backupPostgreSQLDatabase(
  creds: IDataObject,
  databaseName: string,
  options: IDataObject,
  s3Creds: IDataObject,
  fileSuffix?: string
): Promise<IDataObject> {
  const compression = resolveCompression(options);
  const includeSchema = (options.includeSchema as boolean) ?? true;
  const exportedAt = new Date().toISOString();
  const baseName = buildBackupBaseName(options, fileSuffix);
  const ext = backupDataExtension(compression);
  const uploads: IDataObject[] = [];

  if (includeSchema) {
    const schema = await withPostgresClient(
      creds,
      databaseName,
      async (client) => {
        const res = await client.query(`
          SELECT table_name, column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `);
        const out: IDataObject = {};
        for (const row of res.rows) {
          if (!out[row.table_name]) out[row.table_name] = [];
          (out[row.table_name] as object[]).push({
            column: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable === "YES",
            default: row.column_default,
          });
        }
        return out;
      }
    );

    const schemaBody = await jsonToBuffer(
      { database: databaseName, exportedAt, schema },
      compression
    );
    const schemaKey = `postgresql/${databaseName}/${baseName}/_schema.${ext}`;
    const schemaUri = await uploadToS3(
      s3Creds,
      schemaKey,
      schemaBody,
      backupContentType(compression)
    );
    uploads.push({
      table: "_schema",
      s3Uri: schemaUri,
      sizeBytes: schemaBody.byteLength,
    });
  }

  const tableNames = await withPostgresClient(
    creds,
    databaseName,
    async (client) => {
      const tablesRes = await client.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      );
      return tablesRes.rows.map((r: { tablename: string }) => r.tablename);
    }
  );

  for (const tablename of tableNames) {
    let offset = 0;
    let part = 0;

    while (true) {
      const rows = await withPostgresClient(
        creds,
        databaseName,
        async (client) => {
          const dataRes = await client.query(
            `SELECT * FROM "${tablename}" LIMIT $1 OFFSET $2`,
            [ROW_BATCH_SIZE, offset]
          );
          return dataRes.rows;
        }
      );

      if (rows.length === 0 && part > 0) break;

      part = await uploadRecordBatches(
        rows,
        {
          database: databaseName,
          table: tablename,
          exportedAt,
        },
        compression,
        async (body, partIndex, rowCount) => {
          const fileStem =
            partIndex > 1
              ? `${tablename}_part${String(partIndex).padStart(4, "0")}`
              : tablename;
          const key = `postgresql/${databaseName}/${baseName}/${fileStem}.${ext}`;
          const s3Uri = await uploadToS3(
            s3Creds,
            key,
            body,
            backupContentType(compression)
          );
          uploads.push({
            table: tablename,
            part: partIndex,
            s3Uri,
            sizeBytes: body.byteLength,
            rowCount,
          });
        },
        part
      );

      if (rows.length < ROW_BATCH_SIZE) break;
      offset += rows.length;
    }
  }

  return {
    database: databaseName,
    tables: tableNames.length,
    prefix: `postgresql/${databaseName}/${baseName}/`,
    uploads,
    compression,
  };
}

export async function backupPostgreSQL(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const scope = (options.databaseScope as string) || "all";
  const specificDb = requireSpecificName(
    scope,
    (options.databaseName as string) || "",
    "Database name"
  );

  let databaseNames: string[];

  if (scope === "specific") {
    databaseNames = [specificDb];
  } else {
    databaseNames = await withPostgresClient(
      creds,
      creds.database as string,
      async (client) => {
        const res = await client.query(`
          SELECT datname FROM pg_database
          WHERE datallowconn = true AND datistemplate = false
          AND datname NOT IN ('template0', 'template1')
          ORDER BY datname
        `);
        return res.rows.map((r: { datname: string }) => r.datname);
      }
    );
  }

  const backups: IDataObject[] = [];
  const multiDb = databaseNames.length > 1;
  for (const dbName of databaseNames) {
    backups.push(
      await backupPostgreSQLDatabase(
        creds,
        dbName,
        options,
        s3Creds,
        multiDb ? dbName : undefined
      )
    );
  }

  return {
    success: true,
    engine: "postgresql",
    scope,
    databases: databaseNames.length,
    backups,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RabbitMQ
// ─────────────────────────────────────────────────────────────────────────────

export async function httpGet(
  url: string,
  headers: Record<string, string>
): Promise<IDataObject> {
  const https = await import("https");
  const http = await import("http");
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers } as any, (res) => {
        let data = "";
        res.on("data", (c: string) => (data += c));
        res.on("end", () => resolve(JSON.parse(data) as IDataObject));
      })
      .on("error", reject);
  });
}

export async function backupRabbitMQ(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const baseUrl = (creds.url as string).replace(/\/$/, "");
  const vhost = encodeURIComponent((creds.vhost as string) || "/");
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString(
    "base64"
  );
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };
  const compression = resolveCompression(options);

  const definitions = await httpGet(
    `${baseUrl}/api/definitions/${vhost}`,
    headers
  );

  const dump: IDataObject = {
    exportedAt: new Date().toISOString(),
    vhost: creds.vhost as string,
    definitions,
  };

  const safeVhost = (creds.vhost as string).replace(/\//g, "_") || "default";
  const ext = backupDataExtension(compression);
  const fileName = buildBackupFileName(options, ext);
  const body = await jsonToBuffer(dump, compression);
  const key = `rabbitmq/${safeVhost}/${fileName}`;
  const s3Uri = await uploadToS3(
    s3Creds,
    key,
    body,
    backupContentType(compression)
  );

  return {
    success: true,
    engine: "rabbitmq",
    exportType: "definitions",
    vhost: creds.vhost,
    s3Uri,
    compression,
    sizeBytes: body.byteLength,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Qdrant
// ─────────────────────────────────────────────────────────────────────────────

export async function qdrantRequest(
  url: string,
  method: string,
  apiKey?: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const https = await import("https");
  const http = await import("http");

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["api-key"] = apiKey;

    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method, headers } as any, (res) => {
      let data = "";
      res.on("data", (c: string) => (data += c));
      res.on("end", () => {
        try {
          resolve({
            ok: (res.statusCode ?? 500) < 300,
            status: res.statusCode ?? 500,
            data: JSON.parse(data),
          });
        } catch {
          resolve({ ok: false, status: res.statusCode ?? 500, data: {} });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export async function backupQdrant(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const baseUrl = (creds.url as string).replace(/\/$/, "");
  const apiKey = creds.apiKey as string | undefined;
  const waitMs = ((options.waitSeconds as number) ?? 30) * 1000;
  const compression = resolveCompression(options);
  const scope = (options.collectionScope as string) || "all";
  const specificCollection = requireSpecificName(
    scope,
    (options.collectionName as string) || "",
    "Collection name"
  );

  const colRes = await qdrantRequest(`${baseUrl}/collections`, "GET", apiKey);
  if (!colRes.ok)
    throw new Error(`Qdrant /collections returned ${colRes.status}`);

  const allCollections = ((colRes.data as any).result?.collections ?? []).map(
    (c: { name: string }) => c.name
  ) as string[];

  let targets: string[];
  if (scope === "specific") {
    if (!allCollections.includes(specificCollection)) {
      throw new Error(
        `Collection "${specificCollection}" not found. Available: ${allCollections.join(", ") || "(none)"}`
      );
    }
    targets = [specificCollection];
  } else {
    targets = allCollections;
  }

  const results: IDataObject[] = [];

  for (const collection of targets) {
    const snapRes = await qdrantRequest(
      `${baseUrl}/collections/${collection}/snapshots`,
      "POST",
      apiKey
    );
    if (!snapRes.ok)
      throw new Error(
        `Qdrant snapshot creation failed for ${collection}: ${snapRes.status}`
      );

    const snapshotName = ((snapRes.data as any).result?.name ??
      `${collection}_${timestamp()}`) as string;
    await new Promise((r) => setTimeout(r, waitMs));

    const dlRes = await qdrantRequest(
      `${baseUrl}/collections/${collection}/snapshots/${snapshotName}`,
      "GET",
      apiKey
    );
    const snapshotRaw = Buffer.from(JSON.stringify(dlRes.data));
    const snapshotBody = await compressBuffer(snapshotRaw, compression);
    const snapshotExt =
      compression === "none"
        ? "snapshot"
        : `snapshot.${backupDataExtension(compression)}`;
    const fileName = buildBackupFileName(
      options,
      snapshotExt,
      targets.length > 1 ? collection : undefined
    );
    const key = `qdrant/${collection}/${fileName}`;
    const s3Uri = await uploadToS3(
      s3Creds,
      key,
      snapshotBody,
      backupContentType(compression)
    );

    results.push({
      collection,
      snapshotName,
      s3Uri,
      compression,
      sizeBytes: snapshotBody.byteLength,
    });
  }

  return {
    success: true,
    engine: "qdrant",
    scope,
    compression,
    collections: targets.length,
    backups: results,
  };
}
