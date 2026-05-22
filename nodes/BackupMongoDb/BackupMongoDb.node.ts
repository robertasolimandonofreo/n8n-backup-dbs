import { createBackupNodeClass } from "../shared/createBackupNode";

export class BackupMongoDb extends createBackupNodeClass({
  engine: "mongodb",
  displayName: "Backup MongoDB",
  name: "backupMongoDb",
  subtitle: "MongoDB → S3",
  description: "Backup MongoDB databases to Amazon S3",
  dbCredentialType: "mongoDbBackupApi",
  codexLabel: "MongoDB",
  properties: [
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
    },
    {
      displayName: "Database Name",
      name: "databaseName",
      type: "string",
      default: "",
      required: true,
      displayOptions: { show: { databaseScope: ["specific"] } },
    },
  ],
}) {}
