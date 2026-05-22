# n8n-nodes-backup-dbs

n8n community node to backup **RabbitMQ**, **MongoDB**, **PostgreSQL** and **Qdrant** directly to **Amazon S3** using native protocols — no shell commands required.

## Installation

Settings → Community Nodes → Install → `n8n-nodes-backup-dbs`

## How it works

| Engine | Method | Output |
|---|---|---|
| MongoDB | Native driver — iterates all collections | JSON (optionally gzipped) |
| PostgreSQL | Wire protocol — exports schema + all public tables | JSON (optionally gzipped) |
| RabbitMQ | Management HTTP API — exports vhost definitions | JSON (optionally gzipped) |
| Qdrant | REST API — triggers snapshot and downloads it | Binary snapshot |

All backups are streamed directly to S3 — nothing is written to disk on the n8n server.

## Credentials

Create **two** credentials per environment:

### Database Backup

Choose **Application** (MongoDB, PostgreSQL, Qdrant or RabbitMQ). Only the fields for that app are shown.

| Application | Main fields |
|---|---|
| MongoDB | Connection URI, optional database, TLS |
| PostgreSQL | Host, port, database, user, password, SSL |
| Qdrant | Host URL, API key, skip TLS verify |
| RabbitMQ | Management API URL, user, password, virtual host |

### S3 Backup Storage

| Field | Description |
|---|---|
| AWS Access Key ID | IAM access key |
| AWS Secret Access Key | IAM secret key |
| Session Token | Optional — for STS/AssumeRole temporary credentials |
| Region | e.g. `us-east-1` |
| Bucket | Target S3 bucket |
| Key Prefix | Prefix added to every object key (default: `backups/`) |

## Node Options

| Option | Engines | Description |
|---|---|---|
| Backup File Name | All | S3 object file name (empty = timestamp) |
| Database | MongoDB, PostgreSQL | **All Databases** or **Specific Database** + name |
| Collection | Qdrant | **All Collections** or **Specific Collection** + name |
| Export | RabbitMQ | Full **definitions** of the virtual host (queues, exchanges, bindings, etc.) |
| Compress (gzip) | MongoDB, PostgreSQL, RabbitMQ | Gzip before upload |
| Include Schema | PostgreSQL | Column definitions alongside table data |
| Snapshot Wait (seconds) | Qdrant | Wait time for snapshot build (default 30s) |

## S3 Key Structure

```
{keyPrefix}/
  mongodb/{database}/{timestamp}.json.gz
  postgresql/{database}/{timestamp}.json.gz
  rabbitmq/{vhost}/{timestamp}.json.gz
  qdrant/{collection}/{timestamp}.snapshot
```

## IAM Policy for S3

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::YOUR-BUCKET/backups/*"
  }]
}
```

## Output

Each execution returns:

```json
{
  "success": true,
  "engine": "postgresql",
  "database": "mydb",
  "tables": 12,
  "s3Uri": "s3://my-bucket/backups/postgresql/mydb/2024-01-15T10-00-00-000Z.json.gz",
  "compressed": true,
  "sizeBytes": 48320
}
```

## Example Workflow

**Daily backup at 02:00 UTC:**

```
Cron (0 2 * * *)  →  Backup DBs (PostgreSQL)  →  IF success = false  →  Send Alert
```

**Backup all 4 engines in sequence:**

```
Cron  →  Backup DBs (MongoDB)
      →  Backup DBs (PostgreSQL)
      →  Backup DBs (RabbitMQ)
      →  Backup DBs (Qdrant)
      →  Merge results
      →  Notify Slack
```