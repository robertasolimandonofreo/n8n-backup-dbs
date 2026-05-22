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
      displayName: "MongoDB",
      name: "mongodb",
      type: "collection",
      placeholder: "Connection",
      displayOptions: { show: { app: ["mongodb"] } },
      default: {},
      options: [
        {
          displayName: "Connection URI",
          name: "uri",
          type: "string",
          typeOptions: { password: true },
          default: "mongodb://localhost:27017",
          required: true,
          description:
            "Full URI (e.g. mongodb://user:pass@host:27017/dbname)",
        },
        {
          displayName: "TLS/SSL",
          name: "tls",
          type: "boolean",
          default: false,
        },
      ],
    },
    {
      displayName: "PostgreSQL",
      name: "postgres",
      type: "collection",
      placeholder: "Connection",
      displayOptions: { show: { app: ["postgresql"] } },
      default: {},
      options: [
        {
          displayName: "Host",
          name: "host",
          type: "string",
          default: "localhost",
          required: true,
        },
        {
          displayName: "Port",
          name: "port",
          type: "number",
          default: 5432,
          required: true,
        },
        {
          displayName: "Database",
          name: "database",
          type: "string",
          default: "postgres",
          required: true,
          description:
            "Database used to connect. Use postgres when backing up all databases from the node.",
        },
        {
          displayName: "User",
          name: "user",
          type: "string",
          default: "postgres",
          required: true,
        },
        {
          displayName: "Password",
          name: "password",
          type: "string",
          typeOptions: { password: true },
          default: "",
          required: true,
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
        },
      ],
    },
    {
      displayName: "Qdrant",
      name: "qdrant",
      type: "collection",
      placeholder: "Connection",
      displayOptions: { show: { app: ["qdrant"] } },
      default: {},
      options: [
        {
          displayName: "Host URL",
          name: "url",
          type: "string",
          default: "http://localhost:6333",
          required: true,
        },
        {
          displayName: "API Key",
          name: "apiKey",
          type: "string",
          typeOptions: { password: true },
          default: "",
        },
        {
          displayName: "Skip TLS Verify",
          name: "skipVerify",
          type: "boolean",
          default: false,
        },
      ],
    },
    {
      displayName: "RabbitMQ",
      name: "rabbitmq",
      type: "collection",
      placeholder: "Connection",
      displayOptions: { show: { app: ["rabbitmq"] } },
      default: {},
      options: [
        {
          displayName: "Management API URL",
          name: "url",
          type: "string",
          default: "http://localhost:15672",
          required: true,
        },
        {
          displayName: "Username",
          name: "username",
          type: "string",
          default: "guest",
          required: true,
        },
        {
          displayName: "Password",
          name: "password",
          type: "string",
          typeOptions: { password: true },
          default: "guest",
          required: true,
        },
        {
          displayName: "Virtual Host",
          name: "vhost",
          type: "string",
          default: "/",
        },
      ],
    },
  ];
}
