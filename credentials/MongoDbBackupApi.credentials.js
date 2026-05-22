"use strict";
exports.__esModule = true;
exports.MongoDbBackupApi = void 0;
var MongoDbBackupApi = /** @class */ (function () {
  function MongoDbBackupApi() {
    this.name = "mongoDbBackupApi";
    this.displayName = "MongoDB Backup";
    this.documentationUrl = "https://www.mongodb.com/docs/";
    this.properties = [
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
  return MongoDbBackupApi;
})();
exports.MongoDbBackupApi = MongoDbBackupApi;
