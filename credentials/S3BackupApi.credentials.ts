import { ICredentialType, INodeProperties } from "n8n-workflow";

export class S3BackupApi implements ICredentialType {
  name = "s3BackupApi";
  displayName = "S3 Backup Storage";
  documentationUrl = "https://docs.aws.amazon.com/s3/";
  properties: INodeProperties[] = [
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
    },
    {
      displayName: "Key Prefix",
      name: "keyPrefix",
      type: "string",
      default: "backups/",
    },
    {
      displayName: "Storage Class",
      name: "storageClass",
      type: "options",
      options: [
        { name: "Standard", value: "STANDARD" },
        { name: "Standard-IA", value: "STANDARD_IA" },
        { name: "Glacier Instant Retrieval", value: "GLACIER_IR" },
        { name: "Glacier Flexible Retrieval", value: "GLACIER" },
        { name: "Deep Archive", value: "DEEP_ARCHIVE" },
        { name: "Intelligent-Tiering", value: "INTELLIGENT_TIERING" },
      ],
      default: "STANDARD_IA",
      description: "S3 storage class for backup objects (default: Standard-IA)",
    },
  ];
}
