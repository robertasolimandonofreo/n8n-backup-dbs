import { ICredentialType, INodeProperties } from "n8n-workflow";

export class PostgresBackupApi implements ICredentialType {
  name = "postgresBackupApi";
  displayName = "PostgreSQL Backup";
  documentationUrl = "https://www.postgresql.org/docs/";
  properties: INodeProperties[] = [
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
