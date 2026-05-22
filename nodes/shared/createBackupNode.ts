import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";
import { BACKUP_COMPRESSION_OPTIONS } from "./backupCompression";
import { summarizeBackupResult } from "./backupSummary";
import {
  backupMongoDB,
  backupPostgreSQL,
  backupQdrant,
  backupRabbitMQ,
  todayDate,
} from "./backupCore";

type BackupEngine = "mongodb" | "postgresql" | "qdrant" | "rabbitmq";

const backupHandlers: Record<
  BackupEngine,
  (
    creds: IDataObject,
    options: IDataObject,
    s3Creds: IDataObject,
  ) => Promise<IDataObject>
> = {
  mongodb: backupMongoDB,
  postgresql: backupPostgreSQL,
  qdrant: backupQdrant,
  rabbitmq: backupRabbitMQ,
};

export function createBackupNodeClass(config: {
  engine: BackupEngine;
  displayName: string;
  name: string;
  subtitle: string;
  description: string;
  dbCredentialType: string;
  codexLabel: string;
  properties: INodeProperties[];
}): new () => INodeType {
  const description: INodeTypeDescription = {
    displayName: config.displayName,
    name: config.name,
    icon: "file:backupdbs.svg",
    group: ["transform"],
    version: 1,
    subtitle: config.subtitle,
    description: config.description,
    defaults: { name: config.displayName },
    codex: {
      categories: ["Backup DBs"],
      subcategories: {
        "Backup DBs": [config.codexLabel],
      },
    },
    inputs: ["main"] as any,
    outputs: ["main"] as any,
    credentials: [
      {
        name: config.dbCredentialType,
        displayName: "Database",
        required: true,
      },
      {
        name: "s3BackupApi",
        displayName: "Amazon S3",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Backup File Name",
        name: "nameBackup",
        type: "string",
        default: '={{ $now.format("yyyy-MM-dd") }}',
        description:
          "File name uploaded to S3 (without folder path). Defaults to today.",
      },
      {
        displayName: "Compression",
        name: "compression",
        type: "options",
        options: BACKUP_COMPRESSION_OPTIONS.map((o) => ({
          name: o.name,
          value: o.value,
        })),
        default: "lz4",
        description:
          "LZ4 is fastest (StackGres-style). Gzip/Brotli/LZMA trade speed for smaller files.",
      },
      ...config.properties,
    ],
  };

  return class implements INodeType {
    description = description;

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const items = this.getInputData();
      const returnData: IDataObject[] = [];
      const run = backupHandlers[config.engine];

      for (let i = 0; i < items.length; i++) {
        try {
          const dbCreds = await this.getCredentials(config.dbCredentialType);
          const s3Creds = await this.getCredentials("s3BackupApi");

          const options: IDataObject = {
            nameBackup: this.getNodeParameter(
              "nameBackup",
              i,
              todayDate(),
            ) as string,
            compression: this.getNodeParameter("compression", i, "lz4"),
            includeSchema: this.getNodeParameter("includeSchema", i, true),
            databaseScope: this.getNodeParameter("databaseScope", i, "all"),
            databaseName: this.getNodeParameter("databaseName", i, ""),
            collectionScope: this.getNodeParameter("collectionScope", i, "all"),
            collectionName: this.getNodeParameter("collectionName", i, ""),
            waitSeconds: this.getNodeParameter("waitSeconds", i, 30),
          };

          const result = await run(dbCreds, options, s3Creds);
          returnData.push(summarizeBackupResult(result));
        } catch (error) {
          if (this.continueOnFail()) {
            returnData.push({
              success: false,
              error: (error as Error).message,
            });
            continue;
          }
          throw new NodeOperationError(this.getNode(), error as Error);
        }
      }

      return [this.helpers.returnJsonArray(returnData)];
    }
  };
}
