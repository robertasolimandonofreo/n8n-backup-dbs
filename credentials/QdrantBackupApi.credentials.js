"use strict";
exports.__esModule = true;
exports.QdrantBackupApi = void 0;
var QdrantBackupApi = /** @class */ (function () {
  function QdrantBackupApi() {
    this.name = "qdrantBackupApi";
    this.displayName = "Qdrant Backup";
    this.documentationUrl =
      "https://qdrant.tech/documentation/concepts/snapshots/";
    this.properties = [
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
        description:
          "API key for Qdrant Cloud or secured self-hosted instances",
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
  return QdrantBackupApi;
})();
exports.QdrantBackupApi = QdrantBackupApi;
