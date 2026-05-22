import type { IDataObject } from "n8n-workflow";

const ROW_BATCH_SIZE = 10000;

export { ROW_BATCH_SIZE };

export function summarizeBackupResult(result: IDataObject): IDataObject {
  if (result.success === false) {
    return {
      success: false,
      engine: result.engine,
      error: result.error ?? "Backup failed",
    };
  }

  let filesUploaded = 0;
  let totalSizeBytes = 0;
  const s3Prefixes: string[] = [];

  if (typeof result.s3Uri === "string") {
    filesUploaded = 1;
    totalSizeBytes = (result.sizeBytes as number) || 0;
  }

  const backups = result.backups as IDataObject[] | undefined;
  if (backups) {
    for (const entry of backups) {
      if (entry.prefix) s3Prefixes.push(entry.prefix as string);
      const uploads = entry.uploads as IDataObject[] | undefined;
      if (uploads?.length) {
        for (const upload of uploads) {
          filesUploaded += 1;
          totalSizeBytes += (upload.sizeBytes as number) || 0;
        }
      } else if (typeof entry.s3Uri === "string") {
        filesUploaded += 1;
        totalSizeBytes += (entry.sizeBytes as number) || 0;
      }
    }
  }

  const summary: IDataObject = {
    success: true,
    engine: result.engine,
    filesUploaded,
    totalSizeBytes,
    message: `Backup completed: ${filesUploaded} file(s) uploaded to S3`,
  };

  if (result.scope !== undefined) summary.scope = result.scope;
  if (result.compression !== undefined) summary.compression = result.compression;
  if (result.databases !== undefined) summary.databases = result.databases;
  if (result.collections !== undefined) summary.collections = result.collections;
  if (result.vhost !== undefined) summary.vhost = result.vhost;
  if (s3Prefixes.length > 0) summary.s3Prefixes = s3Prefixes;

  return summary;
}
