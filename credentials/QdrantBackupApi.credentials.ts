import { ICredentialType, INodeProperties } from "n8n-workflow";
export class QdrantBackupApi implements ICredentialType {
  name = "qdrantBackupApi";
  displayName = "Qdrant Backup";
  documentationUrl = "https://qdrant.tech/documentation/concepts/snapshots/";
  properties: INodeProperties[] = [
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
  ];
}
