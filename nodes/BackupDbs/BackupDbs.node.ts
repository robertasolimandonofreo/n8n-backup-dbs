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

function sanitizeBackupFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
}

function buildBackupFileName(
  options: IDataObject,
  extension: string,
  suffix?: string
): string {
  const custom = sanitizeBackupFileName(
    ((options.nameBackup as string) || "").trim()
  );

  if (!custom) {
    return `${timestamp()}${suffix ? `_${suffix}` : ""}.${extension}`;
  }

  const base = suffix ? `${custom}_${suffix}` : custom;
  return `${base}.${extension}`;
}

function resolveAppCreds(raw: IDataObject, engine: string): IDataObject {
  const app = (raw.app as string) || engine;

  if (app !== engine) {
    throw new Error(
      `Credential is for ${app} but the node is set to ${engine}. Use matching credentials or change Engine.`,
    );
  }

  if (engine === "mongodb") {
    const m = (raw.mongodb ?? raw) as IDataObject;
    return { uri: m.uri, tls: m.tls };
  }
  if (engine === "postgresql") {
    const p = (raw.postgres ?? raw) as IDataObject;
    return {
      host: p.host,
      port: p.port,
      database: p.database,
      user: p.user,
      password: p.password,
      ssl: p.ssl,
    };
  }
  if (engine === "qdrant") {
    const q = (raw.qdrant ?? raw) as IDataObject;
    return { url: q.url, apiKey: q.apiKey, skipVerify: q.skipVerify };
  }
  if (engine === "rabbitmq") {
    const r = (raw.rabbitmq ?? raw) as IDataObject;
    return {
      url: r.url,
      username: r.username,
      password: r.password,
      vhost: r.vhost,
    };
  }

  throw new Error(`Unsupported application: ${engine}`);
}

function requireSpecificName(scope: string, name: string, label: string): string {
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
      const fileName = buildBackupFileName(
        options,
        ext,
        dbNames.length > 1 ? dbName : undefined
      );
      const key = `mongodb/${dbName}/${fileName}`;
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

async function backupPostgreSQLDatabase(
  creds: IDataObject,
  databaseName: string,
  options: IDataObject,
  s3Creds: IDataObject,
  fileSuffix?: string
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
    database: databaseName,
    user: creds.user as string,
    password: creds.password as string,
    ssl: sslMap[(creds.ssl as string) || "disable"] as any,
  });

  await client.connect();

  try {
    const compress = (options.compress as boolean) ?? true;
    const includeSchema = (options.includeSchema as boolean) ?? true;
    const dump: IDataObject = {
      database: databaseName,
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
    const fileName = buildBackupFileName(options, ext, fileSuffix);
    const key = `postgresql/${databaseName}/${fileName}`;
    const s3Uri = await uploadToS3(
      s3Creds,
      key,
      body,
      compress ? "application/gzip" : "application/json"
    );

    return {
      database: databaseName,
      tables: tablesRes.rows.length,
      s3Uri,
      compressed: compress,
      sizeBytes: body.byteLength,
    };
  } finally {
    await client.end();
  }
}

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

  const scope = (options.databaseScope as string) || "all";
  const specificDb = requireSpecificName(
    scope,
    (options.databaseName as string) || "",
    "Database name"
  );

  const baseConfig = {
    host: creds.host as string,
    port: creds.port as number,
    user: creds.user as string,
    password: creds.password as string,
    ssl: sslMap[(creds.ssl as string) || "disable"] as any,
  };

  let databaseNames: string[];

  if (scope === "specific") {
    databaseNames = [specificDb];
  } else {
    const listClient = new Client({
      ...baseConfig,
      database: creds.database as string,
    });
    await listClient.connect();
    try {
      const res = await listClient.query(`
        SELECT datname FROM pg_database
        WHERE datallowconn = true AND datistemplate = false
        AND datname NOT IN ('template0', 'template1')
        ORDER BY datname
      `);
      databaseNames = res.rows.map((r: { datname: string }) => r.datname);
    } finally {
      await listClient.end();
    }
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
  const fileName = buildBackupFileName(options, ext);
  const key = `rabbitmq/${safeVhost}/${fileName}`;
  const s3Uri = await uploadToS3(
    s3Creds,
    key,
    body,
    compress ? "application/gzip" : "application/json"
  );

  return {
    success: true,
    engine: "rabbitmq",
    exportType: "definitions",
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
    const snapshotBuf = Buffer.from(JSON.stringify(dlRes.data));
    const fileName = buildBackupFileName(
      options,
      "snapshot",
      targets.length > 1 ? collection : undefined
    );
    const key = `qdrant/${collection}/${fileName}`;
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
    scope,
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
        name: "backupAppApi",
        required: true,
        displayOptions: {
          show: { engine: ["mongodb", "postgresql", "rabbitmq", "qdrant"] },
        },
      },
      {
        name: "s3BackupApi",
        required: true,
        displayOptions: {
          show: { engine: ["mongodb", "postgresql", "rabbitmq", "qdrant"] },
        },
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
        displayName: "Backup File Name",
        name: "nameBackup",
        type: "string",
        default: "",
        placeholder: "daily-backup",
        description:
          "File name uploaded to S3 (without folder path). Empty uses a timestamp. When backing up multiple targets, the database or collection name is appended.",
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
        displayName: "Database",
        name: "databaseScope",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "All Databases", value: "all" },
          { name: "Specific Database", value: "specific" },
        ],
        default: "all",
        displayOptions: { show: { engine: ["mongodb", "postgresql"] } },
      },
      {
        displayName: "Database Name",
        name: "databaseName",
        type: "string",
        default: "",
        placeholder: "my_database",
        required: true,
        displayOptions: {
          show: {
            engine: ["mongodb", "postgresql"],
            databaseScope: ["specific"],
          },
        },
      },
      {
        displayName: "Collection",
        name: "collectionScope",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "All Collections", value: "all" },
          { name: "Specific Collection", value: "specific" },
        ],
        default: "all",
        displayOptions: { show: { engine: ["qdrant"] } },
      },
      {
        displayName: "Collection Name",
        name: "collectionName",
        type: "string",
        default: "",
        placeholder: "my_collection",
        required: true,
        displayOptions: {
          show: { engine: ["qdrant"], collectionScope: ["specific"] },
        },
      },
      {
        displayName: "Export",
        name: "rabbitExport",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Full Definitions (vhost)",
            value: "definitions",
          },
        ],
        default: "definitions",
        displayOptions: { show: { engine: ["rabbitmq"] } },
        description:
          "Exports the complete RabbitMQ definitions for the virtual host (queues, exchanges, bindings, users, permissions)",
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
          nameBackup: this.getNodeParameter("nameBackup", i, ""),
          compress: this.getNodeParameter("compress", i, true),
          includeSchema: this.getNodeParameter("includeSchema", i, true),
          databaseScope: this.getNodeParameter("databaseScope", i, "all"),
          databaseName: this.getNodeParameter("databaseName", i, ""),
          collectionScope: this.getNodeParameter("collectionScope", i, "all"),
          collectionName: this.getNodeParameter("collectionName", i, ""),
          waitSeconds: this.getNodeParameter("waitSeconds", i, 30),
        };

        let result: IDataObject;

        const rawAppCreds = await this.getCredentials("backupAppApi");
        let creds: IDataObject;
        try {
          creds = resolveAppCreds(rawAppCreds, engine);
        } catch (error) {
          throw new NodeOperationError(this.getNode(), error as Error);
        }

        if (engine === "mongodb") {
          result = await backupMongoDB(creds, options, s3Creds);
        } else if (engine === "postgresql") {
          result = await backupPostgreSQL(creds, options, s3Creds);
        } else if (engine === "rabbitmq") {
          result = await backupRabbitMQ(creds, options, s3Creds);
        } else if (engine === "qdrant") {
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
