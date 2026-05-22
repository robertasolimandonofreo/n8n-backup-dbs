import {
  compressBuffer,
  type BackupCompression,
} from "./backupCompression";

export function isSerializeLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Invalid string length");
}

export async function recordsToBackupBuffer(
  header: Record<string, unknown>,
  records: unknown[],
  compression: BackupCompression
): Promise<Buffer> {
  const parts: Buffer[] = [
    Buffer.from(
      `${JSON.stringify({ ...header, format: "ndjson" })}\n`,
      "utf8"
    ),
  ];

  for (const record of records) {
    try {
      parts.push(Buffer.from(`${JSON.stringify(record)}\n`, "utf8"));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const target =
        (header.table as string) ||
        (header.collection as string) ||
        "unknown";
      throw new Error(
        `Single row/document in "${target}" is too large to serialize (${detail}). Exclude or split that record manually.`,
      );
    }
  }

  return compressBuffer(Buffer.concat(parts), compression);
}

export async function uploadRecordBatches(
  records: unknown[],
  header: Record<string, unknown>,
  compression: BackupCompression,
  onPart: (body: Buffer, partIndex: number, rowCount: number) => Promise<void>,
  initialPart = 0
): Promise<number> {
  let part = initialPart;

  const uploadChunk = async (chunk: unknown[]): Promise<void> => {
    if (chunk.length === 0) return;
    part += 1;
    try {
      const body = await recordsToBackupBuffer(header, chunk, compression);
      await onPart(body, part, chunk.length);
    } catch (error) {
      if (isSerializeLimitError(error) && chunk.length > 1) {
        part -= 1;
        const mid = Math.ceil(chunk.length / 2);
        await uploadChunk(chunk.slice(0, mid));
        await uploadChunk(chunk.slice(mid));
        return;
      }
      throw error;
    }
  };

  await uploadChunk(records);
  return part;
}
