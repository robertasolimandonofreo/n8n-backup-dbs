import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToS3(
  s3Creds: IDataObject,
  key: string,
  body: Buffer | string,
  contentType = "application/octet-stream"
): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

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

  await client.send(
    new PutObjectCommand({
      Bucket: s3Creds.bucket as string,
      Key: fullKey,
      Body: body,
      ContentType: contentType,
    })
  );

  return `s3://${s3Creds.bucket as string}/${fullKey}`;
}

function gzipAsync(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("zlib").then(({ gzip }) =>
      gzip(buf, (err, result) => (err ? reject(err) : resolve(result)))
    );
  });
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB
// ─────────────────────────────────────────────────────────────────────────────

async function backupMongoDB(
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
    const compress = (options.compress as boolean) ?? true;
    const targetDb = (creds.database as string) || null;

    const dbNames: string[] = targetDb
      ? [targetDb]
      : (await client.db("admin").admin().listDatabases()).databases
          .map((d: { name: string }) => d.name)
          .filter((n: string) => !["admin", "local", "config"].includes(n));

    const results: IDataObject[] = [];

    for (const dbName of dbNames) {
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      const dump: IDataObject = {
        database: dbName,
        exportedAt: new Date().toISOString(),
        collections: {},
      };

      for (const col of collections) {
        const docs = await db.collection(col.name).find({}).toArray();
        (dump.collections as IDataObject)[col.name] = docs;
      }

      let body: Buffer = Buffer.from(JSON.stringify(dump));
      if (compress) body = await gzipAsync(body);

      const ext = compress ? "json.gz" : "json";
      const key = `mongodb/${dbName}/${timestamp()}.${ext}`;
      const s3Uri = await uploadToS3(
        s3Creds,
        key,
        body,
        compress ? "application/gzip" : "application/json"
      );

      results.push({
        database: dbName,
        collections: collections.length,
        s3Uri,
        compressed: compress,
        sizeBytes: body.byteLength,
      });
    }

    return { success: true, engine: "mongodb", backups: results };
  } finally {
    await client.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────

async function backupPostgreSQL(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const { Client } = await import("pg");

  const sslMap: Record<string, boolean | object> = {
    disable: false,
    allow: true,
    require: { rejectUnauthorized: false },
  };

  const client = new Client({
    host: creds.host as string,
    port: creds.port as number,
    database: creds.database as string,
    user: creds.user as string,
    password: creds.password as string,
    ssl: sslMap[(creds.ssl as string) || "disable"] as any,
  });

  await client.connect();

  try {
    const compress = (options.compress as boolean) ?? true;
    const includeSchema = (options.includeSchema as boolean) ?? true;
    const dump: IDataObject = {
      database: creds.database as string,
      exportedAt: new Date().toISOString(),
      tables: {},
    };

    if (includeSchema) {
      const res = await client.query(`
				SELECT table_name, column_name, data_type, is_nullable, column_default
				FROM information_schema.columns
				WHERE table_schema = 'public'
				ORDER BY table_name, ordinal_position
			`);
      const schema: IDataObject = {};
      for (const row of res.rows) {
        if (!schema[row.table_name]) schema[row.table_name] = [];
        (schema[row.table_name] as object[]).push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === "YES",
          default: row.column_default,
        });
      }
      dump.schema = schema;
    }

    const tablesRes = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    for (const { tablename } of tablesRes.rows) {
      const dataRes = await client.query(`SELECT * FROM "${tablename}"`);
      (dump.tables as IDataObject)[tablename] = dataRes.rows;
    }

    let body: Buffer = Buffer.from(JSON.stringify(dump));
    if (compress) body = await gzipAsync(body);

    const ext = compress ? "json.gz" : "json";
    const key = `postgresql/${creds.database}/${timestamp()}.${ext}`;
    const s3Uri = await uploadToS3(
      s3Creds,
      key,
      body,
      compress ? "application/gzip" : "application/json"
    );

    return {
      success: true,
      engine: "postgresql",
      database: creds.database,
      tables: tablesRes.rows.length,
      s3Uri,
      compressed: compress,
      sizeBytes: body.byteLength,
    };
  } finally {
    await client.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RabbitMQ
// ─────────────────────────────────────────────────────────────────────────────

async function httpGet(
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

async function backupRabbitMQ(
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
  const compress = (options.compress as boolean) ?? true;

  const definitions = await httpGet(
    `${baseUrl}/api/definitions/${vhost}`,
    headers
  );

  const dump: IDataObject = {
    exportedAt: new Date().toISOString(),
    vhost: creds.vhost as string,
    definitions,
  };

  let body: Buffer = Buffer.from(JSON.stringify(dump));
  if (compress) body = await gzipAsync(body);

  const safeVhost = (creds.vhost as string).replace(/\//g, "_") || "default";
  const ext = compress ? "json.gz" : "json";
  const key = `rabbitmq/${safeVhost}/${timestamp()}.${ext}`;
  const s3Uri = await uploadToS3(
    s3Creds,
    key,
    body,
    compress ? "application/gzip" : "application/json"
  );

  return {
    success: true,
    engine: "rabbitmq",
    vhost: creds.vhost,
    s3Uri,
    compressed: compress,
    sizeBytes: body.byteLength,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Qdrant
// ─────────────────────────────────────────────────────────────────────────────

async function qdrantRequest(
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

async function backupQdrant(
  creds: IDataObject,
  options: IDataObject,
  s3Creds: IDataObject
): Promise<IDataObject> {
  const baseUrl = (creds.url as string).replace(/\/$/, "");
  const apiKey = creds.apiKey as string | undefined;
  const waitMs = ((options.waitSeconds as number) ?? 30) * 1000;
  const collectionFilter = (options.collections as string) || "";

  const colRes = await qdrantRequest(`${baseUrl}/collections`, "GET", apiKey);
  if (!colRes.ok)
    throw new Error(`Qdrant /collections returned ${colRes.status}`);

  const allCollections = ((colRes.data as any).result?.collections ?? []).map(
    (c: { name: string }) => c.name
  ) as string[];
  const targets = collectionFilter
    ? allCollections.filter((n) =>
        collectionFilter
          .split(",")
          .map((s: string) => s.trim())
          .includes(n)
      )
    : allCollections;

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
    const snapshotBuf = Buffer.from(JSON.stringify(dlRes.data));
    const key = `qdrant/${collection}/${timestamp()}.snapshot`;
    const s3Uri = await uploadToS3(
      s3Creds,
      key,
      snapshotBuf,
      "application/octet-stream"
    );

    results.push({
      collection,
      snapshotName,
      s3Uri,
      sizeBytes: snapshotBuf.byteLength,
    });
  }

  return {
    success: true,
    engine: "qdrant",
    collections: targets.length,
    backups: results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node class
// ─────────────────────────────────────────────────────────────────────────────

export class BackupDbs implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Backup DBs",
    name: "backupDbs",
    icon: "file:backupdbs.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["engine"] + " → S3"}}',
    description:
      "Backup RabbitMQ, MongoDB, PostgreSQL or Qdrant directly to Amazon S3",
    defaults: { name: "Backup DBs" },
    inputs: ["main"] as any,
    outputs: ["main"] as any,
    credentials: [
      {
        name: "s3BackupApi",
        required: true,
        displayOptions: {
          show: { engine: ["mongodb", "postgresql", "rabbitmq", "qdrant"] },
        },
      },
      {
        name: "mongoDbBackupApi",
        required: true,
        displayOptions: { show: { engine: ["mongodb"] } },
      },
      {
        name: "postgresBackupApi",
        required: true,
        displayOptions: { show: { engine: ["postgresql"] } },
      },
      {
        name: "rabbitMqBackupApi",
        required: true,
        displayOptions: { show: { engine: ["rabbitmq"] } },
      },
      {
        name: "qdrantBackupApi",
        required: true,
        displayOptions: { show: { engine: ["qdrant"] } },
      },
    ],
    properties: [
      {
        displayName: "Engine",
        name: "engine",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "MongoDB", value: "mongodb" },
          { name: "PostgreSQL", value: "postgresql" },
          { name: "Qdrant", value: "qdrant" },
          { name: "RabbitMQ", value: "rabbitmq" },
        ],
        default: "postgresql",
      },
      {
        displayName: "Compress (gzip)",
        name: "compress",
        type: "boolean",
        default: true,
        displayOptions: {
          show: { engine: ["mongodb", "postgresql", "rabbitmq"] },
        },
        description: "Whether to gzip the backup before uploading to S3",
      },
      {
        displayName: "Include Schema",
        name: "includeSchema",
        type: "boolean",
        default: true,
        displayOptions: { show: { engine: ["postgresql"] } },
        description:
          "Whether to include column definitions alongside table data",
      },
      {
        displayName: "Notice",
        name: "mongoNotice",
        type: "notice",
        default:
          "All collections are exported as JSON. If Database is set in credentials only that DB is backed up; otherwise all accessible databases are included.",
        displayOptions: { show: { engine: ["mongodb"] } },
      },
      {
        displayName: "Collections",
        name: "collections",
        type: "string",
        default: "",
        placeholder: "products, users",
        displayOptions: { show: { engine: ["qdrant"] } },
        description:
          "Comma-separated collection names. Leave empty to snapshot all collections.",
      },
      {
        displayName: "Snapshot Wait (seconds)",
        name: "waitSeconds",
        type: "number",
        default: 30,
        displayOptions: { show: { engine: ["qdrant"] } },
        description:
          "How long to wait for Qdrant to build the snapshot before downloading",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: IDataObject[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const engine = this.getNodeParameter("engine", i) as string;
        const s3Creds = await this.getCredentials("s3BackupApi");

        const options: IDataObject = {
          compress: this.getNodeParameter("compress", i, true),
          includeSchema: this.getNodeParameter("includeSchema", i, true),
          collections: this.getNodeParameter("collections", i, ""),
          waitSeconds: this.getNodeParameter("waitSeconds", i, 30),
        };

        let result: IDataObject;

        if (engine === "mongodb") {
          const creds = await this.getCredentials("mongoDbBackupApi");
          result = await backupMongoDB(creds, options, s3Creds);
        } else if (engine === "postgresql") {
          const creds = await this.getCredentials("postgresBackupApi");
          result = await backupPostgreSQL(creds, options, s3Creds);
        } else if (engine === "rabbitmq") {
          const creds = await this.getCredentials("rabbitMqBackupApi");
          result = await backupRabbitMQ(creds, options, s3Creds);
        } else if (engine === "qdrant") {
          const creds = await this.getCredentials("qdrantBackupApi");
          result = await backupQdrant(creds, options, s3Creds);
        } else {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported engine: ${engine}`
          );
        }

        returnData.push(result);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ success: false, error: (error as Error).message });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error);
      }
    }

    return [this.helpers.returnJsonArray(returnData)];
  }
}
