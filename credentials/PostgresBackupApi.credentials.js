"use strict";
exports.__esModule = true;
exports.PostgresBackupApi = void 0;
var PostgresBackupApi = /** @class */ (function () {
  function PostgresBackupApi() {
    this.name = "postgresBackupApi";
    this.displayName = "PostgreSQL Backup";
    this.documentationUrl = "https://www.postgresql.org/docs/";
    this.properties = [
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
        description: "Database to back up",
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
    ];
  }
  return PostgresBackupApi;
})();
exports.PostgresBackupApi = PostgresBackupApi;
