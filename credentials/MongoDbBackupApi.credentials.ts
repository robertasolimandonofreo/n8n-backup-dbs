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
    },
    {
      displayName: "TLS/SSL",
      name: "tls",
      type: "boolean",
      default: false,
    },
  ];
}
