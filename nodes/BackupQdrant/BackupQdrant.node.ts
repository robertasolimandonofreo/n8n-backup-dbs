import { createBackupNodeClass } from "../shared/createBackupNode";

export class BackupQdrant extends createBackupNodeClass({
  engine: "qdrant",
  displayName: "Backup Qdrant",
  name: "backupQdrant",
  subtitle: "Qdrant → S3",
  description: "Backup Qdrant collections to Amazon S3",
  dbCredentialType: "qdrantBackupApi",
  codexLabel: "Qdrant",
  properties: [
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
    },
    {
      displayName: "Collection Name",
      name: "collectionName",
      type: "string",
      default: "",
      required: true,
      displayOptions: { show: { collectionScope: ["specific"] } },
    },
    {
      displayName: "Snapshot Wait (seconds)",
      name: "waitSeconds",
      type: "number",
      default: 30,
    },
  ],
}) {}
