"use strict";
exports.__esModule = true;
exports.RabbitMqBackupApi = void 0;
var RabbitMqBackupApi = /** @class */ (function () {
  function RabbitMqBackupApi() {
    this.name = "rabbitMqBackupApi";
    this.displayName = "RabbitMQ Backup";
    this.documentationUrl = "https://www.rabbitmq.com/docs/management";
    this.properties = [
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
  return RabbitMqBackupApi;
})();
exports.RabbitMqBackupApi = RabbitMqBackupApi;
