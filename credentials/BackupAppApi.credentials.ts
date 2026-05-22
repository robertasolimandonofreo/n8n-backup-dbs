import { ICredentialType, INodeProperties } from "n8n-workflow";

export class BackupAppApi implements ICredentialType {
  name = "backupAppApi";
  displayName = "Database Backup";
  documentationUrl =
    "https://github.com/robertasolimandonofreo/n8n-backup-dbs#credentials";
  properties: INodeProperties[] = [
    {
      displayName: "Application",
      name: "app",
      type: "options",
      options: [
        { name: "MongoDB", value: "mongodb" },
        { name: "PostgreSQL", value: "postgresql" },
        { name: "Qdrant", value: "qdrant" },
        { name: "RabbitMQ", value: "rabbitmq" },
      ],
      default: "mongodb",
      required: true,
      description: "Database or broker to back up",
    },
    {
      displayName: "Connection URI",
      name: "uri",
      type: "string",
      typeOptions: { password: true },
      default: "mongodb://localhost:27017",
      required: true,
      displayOptions: { show: { app: ["mongodb"] } },
      description: "Full URI (e.g. mongodb://user:pass@host:27017/dbname)",
    },
    {
      displayName: "TLS/SSL",
      name: "tls",
      type: "boolean",
      default: false,
      displayOptions: { show: { app: ["mongodb"] } },
    },
    {
      displayName: "Host",
      name: "host",
      type: "string",
      default: "localhost",
      required: true,
      displayOptions: { show: { app: ["postgresql"] } },
    },
    {
      displayName: "Port",
      name: "port",
      type: "number",
      default: 5432,
      required: true,
      displayOptions: { show: { app: ["postgresql"] } },
    },
    {
      displayName: "Database",
      name: "database",
      type: "string",
      default: "postgres",
      required: true,
      displayOptions: { show: { app: ["postgresql"] } },
      description:
        "Database used to connect. Use postgres when backing up all databases from the node.",
    },
    {
      displayName: "User",
      name: "user",
      type: "string",
      default: "postgres",
      required: true,
      displayOptions: { show: { app: ["postgresql"] } },
    },
    {
      displayName: "Password",
      name: "password",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      displayOptions: { show: { app: ["postgresql", "rabbitmq"] } },
    },
    {
      displayName: "SSL",
      name: "ssl",
      type: "options",
      options: [
        { name: "Disable", value: "disable" },
        { name: "Allow", value: "allow" },
        { name: "Require", value: "require" },
      ],
      default: "disable",
      displayOptions: { show: { app: ["postgresql"] } },
    },
    {
      displayName: "Host URL",
      name: "url",
      type: "string",
      default: "http://localhost:6333",
      required: true,
      displayOptions: { show: { app: ["qdrant", "rabbitmq"] } },
      description: "Qdrant REST API or RabbitMQ Management API base URL",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      displayOptions: { show: { app: ["qdrant"] } },
    },
    {
      displayName: "Skip TLS Verify",
      name: "skipVerify",
      type: "boolean",
      default: false,
      displayOptions: { show: { app: ["qdrant"] } },
    },
    {
      displayName: "Username",
      name: "username",
      type: "string",
      default: "guest",
      required: true,
      displayOptions: { show: { app: ["rabbitmq"] } },
    },
    {
      displayName: "Virtual Host",
      name: "vhost",
      type: "string",
      default: "/",
      displayOptions: { show: { app: ["rabbitmq"] } },
    },
  ];
}
