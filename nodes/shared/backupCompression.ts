import type { IDataObject } from "n8n-workflow";

export type BackupCompression = "none" | "lz4" | "gzip" | "brotli" | "lzma";

export const BACKUP_COMPRESSION_OPTIONS: {
  name: string;
  value: BackupCompression;
}[] = [
  { name: "None", value: "none" },
  { name: "LZ4 (fast)", value: "lz4" },
  { name: "Gzip", value: "gzip" },
  { name: "Brotli", value: "brotli" },
  { name: "LZMA", value: "lzma" },
];

const VALID: BackupCompression[] = [
  "none",
  "lz4",
  "gzip",
  "brotli",
  "lzma",
];

export function resolveCompression(options: IDataObject): BackupCompression {
  const value = options.compression as string | undefined;
  if (value && VALID.includes(value as BackupCompression)) {
    return value as BackupCompression;
  }
  if (options.compress === false) return "none";
  if (options.compress === true) return "gzip";
  return "lz4";
}

function gzipAsync(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("zlib").then(({ gzip }) =>
      gzip(buf, (err, result) => (err ? reject(err) : resolve(result)))
    );
  });
}

function brotliAsync(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("zlib").then(({ brotliCompress, constants }) =>
      brotliCompress(
        buf,
        {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 4,
          },
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
    );
  });
}

function lz4Async(buf: Buffer): Promise<Buffer> {
  return import("lz4js").then((lz4js) => {
    const compressed = lz4js.compress(buf);
    return Buffer.from(compressed);
  });
}

function lzmaAsync(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("lzma").then((lzma) => {
      lzma.compress(buf, 1, (result: number[] | null, error: unknown) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (!result) {
          reject(new Error("LZMA compression returned empty result"));
          return;
        }
        resolve(Buffer.from(result));
      });
    });
  });
}

export async function compressBuffer(
  buf: Buffer,
  algorithm: BackupCompression
): Promise<Buffer> {
  switch (algorithm) {
    case "none":
      return buf;
    case "gzip":
      return gzipAsync(buf);
    case "brotli":
      return brotliAsync(buf);
    case "lz4":
      return lz4Async(buf);
    case "lzma":
      return lzmaAsync(buf);
    default:
      return buf;
  }
}

export function backupDataExtension(algorithm: BackupCompression): string {
  switch (algorithm) {
    case "none":
      return "json";
    case "lz4":
      return "json.lz4";
    case "gzip":
      return "json.gz";
    case "brotli":
      return "json.br";
    case "lzma":
      return "json.xz";
    default:
      return "json";
  }
}

export function backupContentType(algorithm: BackupCompression): string {
  switch (algorithm) {
    case "none":
      return "application/json";
    case "lz4":
      return "application/x-lz4";
    case "gzip":
      return "application/gzip";
    case "brotli":
      return "application/x-brotli";
    case "lzma":
      return "application/x-xz";
    default:
      return "application/octet-stream";
  }
}

export async function jsonToBuffer(
  data: unknown,
  compression: BackupCompression
): Promise<Buffer> {
  let json: string;
  try {
    json = JSON.stringify(data);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Backup data is too large to serialize (${detail}). Use a specific database/table or smaller scope.`,
    );
  }
  return compressBuffer(Buffer.from(json, "utf8"), compression);
}
