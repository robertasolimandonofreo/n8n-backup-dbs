import { createBackupNodeClass } from "../shared/createBackupNode";

export class BackupRabbitMq extends createBackupNodeClass({
  engine: "rabbitmq",
  displayName: "Backup RabbitMQ",
  name: "backupRabbitMq",
  subtitle: "RabbitMQ → S3",
  description: "Backup RabbitMQ vhost definitions to Amazon S3",
  dbCredentialType: "rabbitMqBackupApi",
  codexLabel: "RabbitMQ",
  properties: [
    {
      displayName: "Compress (gzip)",
      name: "compress",
      type: "boolean",
      default: true,
    },
  ],
}) {}
