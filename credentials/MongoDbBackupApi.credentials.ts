import { ICredentialType, INodeProperties } from "n8n-workflow";

export class MongoDbBackupApi implements ICredentialType {
  name = "mongoDbBackupApi";
  displayName = "MongoDB Backup";
  documentationUrl = "https://www.mongodb.com/docs/";
  properties: INodeProperties[] = [
    {
      displayName: "Connection URI",
      name: "uri",
      type: "string",
      typeOptions: { password: true },
      default: "mongodb://localhost:27017",
      required: true,
      description:
        "Full MongoDB connection URI (e.g. mongodb://user:pass@host:27017/dbname)",
    },
    {
      displayName: "Database",
      name: "database",
      type: "string",
      default: "",
      description:
        "Database to back up. Leave empty to back up all databases accessible by the user.",
    },
    {
      displayName: "TLS/SSL",
      name: "tls",
      type: "boolean",
      default: false,
      description: "Whether to enable TLS for the connection",
    },
  ];
}
