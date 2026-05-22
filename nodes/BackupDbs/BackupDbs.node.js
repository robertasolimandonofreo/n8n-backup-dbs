"use strict";
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
exports.__esModule = true;
exports.BackupDbs = void 0;
var n8n_workflow_1 = require("n8n-workflow");
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function uploadToS3(s3Creds, key, body, contentType) {
  if (contentType === void 0) {
    contentType = "application/octet-stream";
  }
  return __awaiter(this, void 0, void 0, function () {
    var _a, S3Client, PutObjectCommand, client, prefix, fullKey;
    return __generator(this, function (_b) {
      switch (_b.label) {
        case 0:
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("@aws-sdk/client-s3");
            }),
          ];
        case 1:
          (_a = _b.sent()),
            (S3Client = _a.S3Client),
            (PutObjectCommand = _a.PutObjectCommand);
          client = new S3Client({
            region: s3Creds.region,
            credentials: __assign(
              {
                accessKeyId: s3Creds.accessKeyId,
                secretAccessKey: s3Creds.secretAccessKey,
              },
              s3Creds.sessionToken ? { sessionToken: s3Creds.sessionToken } : {}
            ),
          });
          prefix = (s3Creds.keyPrefix || "").replace(/\/$/, "");
          fullKey = prefix ? "".concat(prefix, "/").concat(key) : key;
          return [
            4 /*yield*/,
            client.send(
              new PutObjectCommand({
                Bucket: s3Creds.bucket,
                Key: fullKey,
                Body: body,
                ContentType: contentType,
              })
            ),
          ];
        case 2:
          _b.sent();
          return [
            2 /*return*/,
            "s3://".concat(s3Creds.bucket, "/").concat(fullKey),
          ];
      }
    });
  });
}
function gzipAsync(buf) {
  return new Promise(function (resolve, reject) {
    Promise.resolve()
      .then(function () {
        return require("zlib");
      })
      .then(function (_a) {
        var gzip = _a.gzip;
        return gzip(buf, function (err, result) {
          return err ? reject(err) : resolve(result);
        });
      });
  });
}
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
// ─────────────────────────────────────────────────────────────────────────────
// MongoDB
// ─────────────────────────────────────────────────────────────────────────────
function backupMongoDB(creds, options, s3Creds) {
  var _a, _b;
  return __awaiter(this, void 0, void 0, function () {
    var MongoClient,
      client,
      compress,
      targetDb,
      dbNames,
      _c,
      results,
      _i,
      dbNames_1,
      dbName,
      db,
      collections,
      dump,
      _d,
      collections_1,
      col,
      docs,
      body,
      ext,
      key,
      s3Uri;
    return __generator(this, function (_e) {
      switch (_e.label) {
        case 0:
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("mongodb");
            }),
          ];
        case 1:
          MongoClient = _e.sent().MongoClient;
          client = new MongoClient(creds.uri, {
            tls: (_a = creds.tls) !== null && _a !== void 0 ? _a : false,
          });
          _e.label = 2;
        case 2:
          _e.trys.push([2, , 18, 20]);
          return [4 /*yield*/, client.connect()];
        case 3:
          _e.sent();
          compress =
            (_b = options.compress) !== null && _b !== void 0 ? _b : true;
          targetDb = creds.database || null;
          if (!targetDb) return [3 /*break*/, 4];
          _c = [targetDb];
          return [3 /*break*/, 6];
        case 4:
          return [4 /*yield*/, client.db("admin").admin().listDatabases()];
        case 5:
          _c = _e
            .sent()
            .databases.map(function (d) {
              return d.name;
            })
            .filter(function (n) {
              return !["admin", "local", "config"].includes(n);
            });
          _e.label = 6;
        case 6:
          dbNames = _c;
          results = [];
          (_i = 0), (dbNames_1 = dbNames);
          _e.label = 7;
        case 7:
          if (!(_i < dbNames_1.length)) return [3 /*break*/, 17];
          dbName = dbNames_1[_i];
          db = client.db(dbName);
          return [4 /*yield*/, db.listCollections().toArray()];
        case 8:
          collections = _e.sent();
          dump = {
            database: dbName,
            exportedAt: new Date().toISOString(),
            collections: {},
          };
          (_d = 0), (collections_1 = collections);
          _e.label = 9;
        case 9:
          if (!(_d < collections_1.length)) return [3 /*break*/, 12];
          col = collections_1[_d];
          return [4 /*yield*/, db.collection(col.name).find({}).toArray()];
        case 10:
          docs = _e.sent();
          dump.collections[col.name] = docs;
          _e.label = 11;
        case 11:
          _d++;
          return [3 /*break*/, 9];
        case 12:
          body = Buffer.from(JSON.stringify(dump));
          if (!compress) return [3 /*break*/, 14];
          return [4 /*yield*/, gzipAsync(body)];
        case 13:
          body = _e.sent();
          _e.label = 14;
        case 14:
          ext = compress ? "json.gz" : "json";
          key = "mongodb/"
            .concat(dbName, "/")
            .concat(timestamp(), ".")
            .concat(ext);
          return [
            4 /*yield*/,
            uploadToS3(
              s3Creds,
              key,
              body,
              compress ? "application/gzip" : "application/json"
            ),
          ];
        case 15:
          s3Uri = _e.sent();
          results.push({
            database: dbName,
            collections: collections.length,
            s3Uri: s3Uri,
            compressed: compress,
            sizeBytes: body.byteLength,
          });
          _e.label = 16;
        case 16:
          _i++;
          return [3 /*break*/, 7];
        case 17:
          return [
            2 /*return*/,
            { success: true, engine: "mongodb", backups: results },
          ];
        case 18:
          return [4 /*yield*/, client.close()];
        case 19:
          _e.sent();
          return [7 /*endfinally*/];
        case 20:
          return [2 /*return*/];
      }
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────
function backupPostgreSQL(creds, options, s3Creds) {
  var _a, _b;
  return __awaiter(this, void 0, void 0, function () {
    var Client,
      sslMap,
      client,
      compress,
      includeSchema,
      dump,
      res,
      schema,
      _i,
      _c,
      row,
      tablesRes,
      _d,
      _e,
      tablename,
      dataRes,
      body,
      ext,
      key,
      s3Uri;
    return __generator(this, function (_f) {
      switch (_f.label) {
        case 0:
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("pg");
            }),
          ];
        case 1:
          Client = _f.sent().Client;
          sslMap = {
            disable: false,
            allow: true,
            require: { rejectUnauthorized: false },
          };
          client = new Client({
            host: creds.host,
            port: creds.port,
            database: creds.database,
            user: creds.user,
            password: creds.password,
            ssl: sslMap[creds.ssl || "disable"],
          });
          return [4 /*yield*/, client.connect()];
        case 2:
          _f.sent();
          _f.label = 3;
        case 3:
          _f.trys.push([3, , 14, 16]);
          compress =
            (_a = options.compress) !== null && _a !== void 0 ? _a : true;
          includeSchema =
            (_b = options.includeSchema) !== null && _b !== void 0 ? _b : true;
          dump = {
            database: creds.database,
            exportedAt: new Date().toISOString(),
            tables: {},
          };
          if (!includeSchema) return [3 /*break*/, 5];
          return [
            4 /*yield*/,
            client.query(
              "\n\t\t\t\tSELECT table_name, column_name, data_type, is_nullable, column_default\n\t\t\t\tFROM information_schema.columns\n\t\t\t\tWHERE table_schema = 'public'\n\t\t\t\tORDER BY table_name, ordinal_position\n\t\t\t"
            ),
          ];
        case 4:
          res = _f.sent();
          schema = {};
          for (_i = 0, _c = res.rows; _i < _c.length; _i++) {
            row = _c[_i];
            if (!schema[row.table_name]) schema[row.table_name] = [];
            schema[row.table_name].push({
              column: row.column_name,
              type: row.data_type,
              nullable: row.is_nullable === "YES",
              default: row.column_default,
            });
          }
          dump.schema = schema;
          _f.label = 5;
        case 5:
          return [
            4 /*yield*/,
            client.query(
              "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            ),
          ];
        case 6:
          tablesRes = _f.sent();
          (_d = 0), (_e = tablesRes.rows);
          _f.label = 7;
        case 7:
          if (!(_d < _e.length)) return [3 /*break*/, 10];
          tablename = _e[_d].tablename;
          return [
            4 /*yield*/,
            client.query('SELECT * FROM "'.concat(tablename, '"')),
          ];
        case 8:
          dataRes = _f.sent();
          dump.tables[tablename] = dataRes.rows;
          _f.label = 9;
        case 9:
          _d++;
          return [3 /*break*/, 7];
        case 10:
          body = Buffer.from(JSON.stringify(dump));
          if (!compress) return [3 /*break*/, 12];
          return [4 /*yield*/, gzipAsync(body)];
        case 11:
          body = _f.sent();
          _f.label = 12;
        case 12:
          ext = compress ? "json.gz" : "json";
          key = "postgresql/"
            .concat(creds.database, "/")
            .concat(timestamp(), ".")
            .concat(ext);
          return [
            4 /*yield*/,
            uploadToS3(
              s3Creds,
              key,
              body,
              compress ? "application/gzip" : "application/json"
            ),
          ];
        case 13:
          s3Uri = _f.sent();
          return [
            2 /*return*/,
            {
              success: true,
              engine: "postgresql",
              database: creds.database,
              tables: tablesRes.rows.length,
              s3Uri: s3Uri,
              compressed: compress,
              sizeBytes: body.byteLength,
            },
          ];
        case 14:
          return [4 /*yield*/, client.end()];
        case 15:
          _f.sent();
          return [7 /*endfinally*/];
        case 16:
          return [2 /*return*/];
      }
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// RabbitMQ
// ─────────────────────────────────────────────────────────────────────────────
function httpGet(url, headers) {
  return __awaiter(this, void 0, void 0, function () {
    var https, http;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("https");
            }),
          ];
        case 1:
          https = _a.sent();
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("http");
            }),
          ];
        case 2:
          http = _a.sent();
          return [
            2 /*return*/,
            new Promise(function (resolve, reject) {
              var lib = url.startsWith("https") ? https : http;
              lib
                .get(url, { headers: headers }, function (res) {
                  var data = "";
                  res.on("data", function (c) {
                    return (data += c);
                  });
                  res.on("end", function () {
                    return resolve(JSON.parse(data));
                  });
                })
                .on("error", reject);
            }),
          ];
      }
    });
  });
}
function backupRabbitMQ(creds, options, s3Creds) {
  var _a;
  return __awaiter(this, void 0, void 0, function () {
    var baseUrl,
      vhost,
      auth,
      headers,
      compress,
      definitions,
      dump,
      body,
      safeVhost,
      ext,
      key,
      s3Uri;
    return __generator(this, function (_b) {
      switch (_b.label) {
        case 0:
          baseUrl = creds.url.replace(/\/$/, "");
          vhost = encodeURIComponent(creds.vhost || "/");
          auth = Buffer.from(
            "".concat(creds.username, ":").concat(creds.password)
          ).toString("base64");
          headers = {
            Authorization: "Basic ".concat(auth),
            "Content-Type": "application/json",
          };
          compress =
            (_a = options.compress) !== null && _a !== void 0 ? _a : true;
          return [
            4 /*yield*/,
            httpGet(
              "".concat(baseUrl, "/api/definitions/").concat(vhost),
              headers
            ),
          ];
        case 1:
          definitions = _b.sent();
          dump = {
            exportedAt: new Date().toISOString(),
            vhost: creds.vhost,
            definitions: definitions,
          };
          body = Buffer.from(JSON.stringify(dump));
          if (!compress) return [3 /*break*/, 3];
          return [4 /*yield*/, gzipAsync(body)];
        case 2:
          body = _b.sent();
          _b.label = 3;
        case 3:
          safeVhost = creds.vhost.replace(/\//g, "_") || "default";
          ext = compress ? "json.gz" : "json";
          key = "rabbitmq/"
            .concat(safeVhost, "/")
            .concat(timestamp(), ".")
            .concat(ext);
          return [
            4 /*yield*/,
            uploadToS3(
              s3Creds,
              key,
              body,
              compress ? "application/gzip" : "application/json"
            ),
          ];
        case 4:
          s3Uri = _b.sent();
          return [
            2 /*return*/,
            {
              success: true,
              engine: "rabbitmq",
              vhost: creds.vhost,
              s3Uri: s3Uri,
              compressed: compress,
              sizeBytes: body.byteLength,
            },
          ];
      }
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// Qdrant
// ─────────────────────────────────────────────────────────────────────────────
function qdrantRequest(url, method, apiKey) {
  return __awaiter(this, void 0, void 0, function () {
    var https, http;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("https");
            }),
          ];
        case 1:
          https = _a.sent();
          return [
            4 /*yield*/,
            Promise.resolve().then(function () {
              return require("http");
            }),
          ];
        case 2:
          http = _a.sent();
          return [
            2 /*return*/,
            new Promise(function (resolve, reject) {
              var headers = { "Content-Type": "application/json" };
              if (apiKey) headers["api-key"] = apiKey;
              var lib = url.startsWith("https") ? https : http;
              var req = lib.request(
                url,
                { method: method, headers: headers },
                function (res) {
                  var data = "";
                  res.on("data", function (c) {
                    return (data += c);
                  });
                  res.on("end", function () {
                    var _a, _b, _c;
                    try {
                      resolve({
                        ok:
                          ((_a = res.statusCode) !== null && _a !== void 0
                            ? _a
                            : 500) < 300,
                        status:
                          (_b = res.statusCode) !== null && _b !== void 0
                            ? _b
                            : 500,
                        data: JSON.parse(data),
                      });
                    } catch (_d) {
                      resolve({
                        ok: false,
                        status:
                          (_c = res.statusCode) !== null && _c !== void 0
                            ? _c
                            : 500,
                        data: {},
                      });
                    }
                  });
                }
              );
              req.on("error", reject);
              req.end();
            }),
          ];
      }
    });
  });
}
function backupQdrant(creds, options, s3Creds) {
  var _a, _b, _c, _d, _e;
  return __awaiter(this, void 0, void 0, function () {
    var baseUrl,
      apiKey,
      waitMs,
      collectionFilter,
      colRes,
      allCollections,
      targets,
      results,
      _i,
      targets_1,
      collection,
      snapRes,
      snapshotName,
      dlRes,
      snapshotBuf,
      key,
      s3Uri;
    return __generator(this, function (_f) {
      switch (_f.label) {
        case 0:
          baseUrl = creds.url.replace(/\/$/, "");
          apiKey = creds.apiKey;
          waitMs =
            ((_a = options.waitSeconds) !== null && _a !== void 0 ? _a : 30) *
            1000;
          collectionFilter = options.collections || "";
          return [
            4 /*yield*/,
            qdrantRequest("".concat(baseUrl, "/collections"), "GET", apiKey),
          ];
        case 1:
          colRes = _f.sent();
          if (!colRes.ok)
            throw new Error(
              "Qdrant /collections returned ".concat(colRes.status)
            );
          allCollections = (
            (_c =
              (_b = colRes.data.result) === null || _b === void 0
                ? void 0
                : _b.collections) !== null && _c !== void 0
              ? _c
              : []
          ).map(function (c) {
            return c.name;
          });
          targets = collectionFilter
            ? allCollections.filter(function (n) {
                return collectionFilter
                  .split(",")
                  .map(function (s) {
                    return s.trim();
                  })
                  .includes(n);
              })
            : allCollections;
          results = [];
          (_i = 0), (targets_1 = targets);
          _f.label = 2;
        case 2:
          if (!(_i < targets_1.length)) return [3 /*break*/, 8];
          collection = targets_1[_i];
          return [
            4 /*yield*/,
            qdrantRequest(
              ""
                .concat(baseUrl, "/collections/")
                .concat(collection, "/snapshots"),
              "POST",
              apiKey
            ),
          ];
        case 3:
          snapRes = _f.sent();
          if (!snapRes.ok)
            throw new Error(
              "Qdrant snapshot creation failed for "
                .concat(collection, ": ")
                .concat(snapRes.status)
            );
          snapshotName =
            (_e =
              (_d = snapRes.data.result) === null || _d === void 0
                ? void 0
                : _d.name) !== null && _e !== void 0
              ? _e
              : "".concat(collection, "_").concat(timestamp());
          return [
            4 /*yield*/,
            new Promise(function (r) {
              return setTimeout(r, waitMs);
            }),
          ];
        case 4:
          _f.sent();
          return [
            4 /*yield*/,
            qdrantRequest(
              ""
                .concat(baseUrl, "/collections/")
                .concat(collection, "/snapshots/")
                .concat(snapshotName),
              "GET",
              apiKey
            ),
          ];
        case 5:
          dlRes = _f.sent();
          snapshotBuf = Buffer.from(JSON.stringify(dlRes.data));
          key = "qdrant/"
            .concat(collection, "/")
            .concat(timestamp(), ".snapshot");
          return [
            4 /*yield*/,
            uploadToS3(s3Creds, key, snapshotBuf, "application/octet-stream"),
          ];
        case 6:
          s3Uri = _f.sent();
          results.push({
            collection: collection,
            snapshotName: snapshotName,
            s3Uri: s3Uri,
            sizeBytes: snapshotBuf.byteLength,
          });
          _f.label = 7;
        case 7:
          _i++;
          return [3 /*break*/, 2];
        case 8:
          return [
            2 /*return*/,
            {
              success: true,
              engine: "qdrant",
              collections: targets.length,
              backups: results,
            },
          ];
      }
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// Node class
// ─────────────────────────────────────────────────────────────────────────────
var BackupDbs = /** @class */ (function () {
  function BackupDbs() {
    this.description = {
      displayName: "Backup DBs",
      name: "backupDbs",
      icon: "file:backupdbs.svg",
      group: ["transform"],
      version: 1,
      subtitle: '={{$parameter["engine"] + " → S3"}}',
      description:
        "Backup RabbitMQ, MongoDB, PostgreSQL or Qdrant directly to Amazon S3",
      defaults: { name: "Backup DBs" },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [
        {
          name: "s3BackupApi",
          required: true,
          displayOptions: {
            show: { engine: ["mongodb", "postgresql", "rabbitmq", "qdrant"] },
          },
        },
        {
          name: "mongoDbBackupApi",
          required: true,
          displayOptions: { show: { engine: ["mongodb"] } },
        },
        {
          name: "postgresBackupApi",
          required: true,
          displayOptions: { show: { engine: ["postgresql"] } },
        },
        {
          name: "rabbitMqBackupApi",
          required: true,
          displayOptions: { show: { engine: ["rabbitmq"] } },
        },
        {
          name: "qdrantBackupApi",
          required: true,
          displayOptions: { show: { engine: ["qdrant"] } },
        },
      ],
      properties: [
        {
          displayName: "Engine",
          name: "engine",
          type: "options",
          noDataExpression: true,
          options: [
            { name: "MongoDB", value: "mongodb" },
            { name: "PostgreSQL", value: "postgresql" },
            { name: "Qdrant", value: "qdrant" },
            { name: "RabbitMQ", value: "rabbitmq" },
          ],
          default: "postgresql",
        },
        {
          displayName: "Compress (gzip)",
          name: "compress",
          type: "boolean",
          default: true,
          displayOptions: {
            show: { engine: ["mongodb", "postgresql", "rabbitmq"] },
          },
          description: "Whether to gzip the backup before uploading to S3",
        },
        {
          displayName: "Include Schema",
          name: "includeSchema",
          type: "boolean",
          default: true,
          displayOptions: { show: { engine: ["postgresql"] } },
          description:
            "Whether to include column definitions alongside table data",
        },
        {
          displayName: "Notice",
          name: "mongoNotice",
          type: "notice",
          default:
            "All collections are exported as JSON. If Database is set in credentials only that DB is backed up; otherwise all accessible databases are included.",
          displayOptions: { show: { engine: ["mongodb"] } },
        },
        {
          displayName: "Collections",
          name: "collections",
          type: "string",
          default: "",
          placeholder: "products, users",
          displayOptions: { show: { engine: ["qdrant"] } },
          description:
            "Comma-separated collection names. Leave empty to snapshot all collections.",
        },
        {
          displayName: "Snapshot Wait (seconds)",
          name: "waitSeconds",
          type: "number",
          default: 30,
          displayOptions: { show: { engine: ["qdrant"] } },
          description:
            "How long to wait for Qdrant to build the snapshot before downloading",
        },
      ],
    };
  }
  BackupDbs.prototype.execute = function () {
    return __awaiter(this, void 0, void 0, function () {
      var items,
        returnData,
        i,
        engine,
        s3Creds,
        options,
        result,
        creds,
        creds,
        creds,
        creds,
        error_1;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            items = this.getInputData();
            returnData = [];
            i = 0;
            _a.label = 1;
          case 1:
            if (!(i < items.length)) return [3 /*break*/, 19];
            _a.label = 2;
          case 2:
            _a.trys.push([2, 17, , 18]);
            engine = this.getNodeParameter("engine", i);
            return [4 /*yield*/, this.getCredentials("s3BackupApi")];
          case 3:
            s3Creds = _a.sent();
            options = {
              compress: this.getNodeParameter("compress", i, true),
              includeSchema: this.getNodeParameter("includeSchema", i, true),
              collections: this.getNodeParameter("collections", i, ""),
              waitSeconds: this.getNodeParameter("waitSeconds", i, 30),
            };
            result = void 0;
            if (!(engine === "mongodb")) return [3 /*break*/, 6];
            return [4 /*yield*/, this.getCredentials("mongoDbBackupApi")];
          case 4:
            creds = _a.sent();
            return [4 /*yield*/, backupMongoDB(creds, options, s3Creds)];
          case 5:
            result = _a.sent();
            return [3 /*break*/, 16];
          case 6:
            if (!(engine === "postgresql")) return [3 /*break*/, 9];
            return [4 /*yield*/, this.getCredentials("postgresBackupApi")];
          case 7:
            creds = _a.sent();
            return [4 /*yield*/, backupPostgreSQL(creds, options, s3Creds)];
          case 8:
            result = _a.sent();
            return [3 /*break*/, 16];
          case 9:
            if (!(engine === "rabbitmq")) return [3 /*break*/, 12];
            return [4 /*yield*/, this.getCredentials("rabbitMqBackupApi")];
          case 10:
            creds = _a.sent();
            return [4 /*yield*/, backupRabbitMQ(creds, options, s3Creds)];
          case 11:
            result = _a.sent();
            return [3 /*break*/, 16];
          case 12:
            if (!(engine === "qdrant")) return [3 /*break*/, 15];
            return [4 /*yield*/, this.getCredentials("qdrantBackupApi")];
          case 13:
            creds = _a.sent();
            return [4 /*yield*/, backupQdrant(creds, options, s3Creds)];
          case 14:
            result = _a.sent();
            return [3 /*break*/, 16];
          case 15:
            throw new n8n_workflow_1.NodeOperationError(
              this.getNode(),
              "Unsupported engine: ".concat(engine)
            );
          case 16:
            returnData.push(result);
            return [3 /*break*/, 18];
          case 17:
            error_1 = _a.sent();
            if (this.continueOnFail()) {
              returnData.push({ success: false, error: error_1.message });
              return [3 /*break*/, 18];
            }
            throw new n8n_workflow_1.NodeOperationError(
              this.getNode(),
              error_1
            );
          case 18:
            i++;
            return [3 /*break*/, 1];
          case 19:
            return [2 /*return*/, [this.helpers.returnJsonArray(returnData)]];
        }
      });
    });
  };
  return BackupDbs;
})();
exports.BackupDbs = BackupDbs;
