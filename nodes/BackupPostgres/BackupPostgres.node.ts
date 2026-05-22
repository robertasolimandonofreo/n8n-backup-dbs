import { createBackupNodeClass } from "../shared/createBackupNode";

export class BackupPostgres extends createBackupNodeClass({
  engine: "postgresql",
  displayName: "Backup PostgreSQL",
  name: "backupPostgres",
  subtitle: "PostgreSQL → S3",
  description: "Backup PostgreSQL databases to Amazon S3",
  dbCredentialType: "postgresBackupApi",
  codexLabel: "PostgreSQL",
  properties: [
    {
      displayName: "Compress (gzip)",
      name: "compress",
      type: "boolean",
      default: true,
    },
    {
      displayName: "Include Schema",
      name: "includeSchema",
      type: "boolean",
      default: true,
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
