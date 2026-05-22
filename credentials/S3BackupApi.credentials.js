"use strict";
exports.__esModule = true;
exports.S3BackupApi = void 0;
var S3BackupApi = /** @class */ (function () {
  function S3BackupApi() {
    this.name = "s3BackupApi";
    this.displayName = "S3 Backup Storage";
    this.documentationUrl = "https://docs.aws.amazon.com/s3/";
    this.properties = [
      {
        displayName: "AWS Access Key ID",
        name: "accessKeyId",
        type: "string",
        default: "",
        required: true,
      },
      {
        displayName: "AWS Secret Access Key",
        name: "secretAccessKey",
        type: "string",
        typeOptions: { password: true },
        default: "",
        required: true,
      },
      {
        displayName: "Session Token",
        name: "sessionToken",
        type: "string",
        typeOptions: { password: true },
        default: "",
        description:
          "Temporary STS session token — leave empty for permanent credentials",
      },
      {
        displayName: "Region",
        name: "region",
        type: "string",
        default: "us-east-1",
        required: true,
      },
      {
        displayName: "Bucket",
        name: "bucket",
        type: "string",
        default: "",
        required: true,
        description: "S3 bucket where backups will be stored",
      },
      {
        displayName: "Key Prefix",
        name: "keyPrefix",
        type: "string",
        default: "backups/",
        description: "Prefix (folder path) added to every backup object key",
      },
    ];
  }
  return S3BackupApi;
})();
exports.S3BackupApi = S3BackupApi;
