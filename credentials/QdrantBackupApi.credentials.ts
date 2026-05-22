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
      description: "Qdrant REST API base URL",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description: "API key for Qdrant Cloud or secured self-hosted instances",
    },
    {
      displayName: "TLS / Skip Verify",
      name: "skipVerify",
      type: "boolean",
      default: false,
      description:
        "Whether to skip TLS certificate verification (not recommended for production)",
    },
  ];
}
