import { ICredentialType, INodeProperties } from "n8n-workflow";

export class RabbitMqBackupApi implements ICredentialType {
  name = "rabbitMqBackupApi";
  displayName = "RabbitMQ Backup";
  documentationUrl = "https://www.rabbitmq.com/docs/management";
  properties: INodeProperties[] = [
    {
      displayName: "Management API URL",
      name: "url",
      type: "string",
      default: "http://localhost:15672",
      required: true,
      description: "Base URL of the RabbitMQ Management HTTP API",
    },
    {
      displayName: "Username",
      name: "username",
      type: "string",
      default: "guest",
      required: true,
    },
    {
      displayName: "Password",
      name: "password",
      type: "string",
      typeOptions: { password: true },
      default: "guest",
      required: true,
    },
    {
      displayName: "Virtual Host",
      name: "vhost",
      type: "string",
      default: "/",
      description:
        "Virtual host to export definitions from. Leave as / for the default vhost.",
    },
  ];
}
