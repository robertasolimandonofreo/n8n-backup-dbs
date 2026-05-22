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

### S3 Backup Storage (required for all engines)

| Field | Description |
|---|---|
| AWS Access Key ID | IAM access key |
| AWS Secret Access Key | IAM secret key |
| Session Token | Optional — for STS/AssumeRole temporary credentials |
| Region | e.g. `us-east-1` |
| Bucket | Target S3 bucket |
| Key Prefix | Prefix added to every object key (default: `backups/`) |

### MongoDB Backup

| Field | Description |
|---|---|
| Connection URI | Full URI e.g. `mongodb://user:pass@host:27017/mydb` |
| Database | Leave blank to backup all accessible databases |
| TLS/SSL | Enable TLS |

### PostgreSQL Backup

| Field | Description |
|---|---|
| Host | Database host |
| Port | Default `5432` |
| Database | Database name |
| User / Password | Credentials |
| SSL | `disable`, `allow` or `require` |

### RabbitMQ Backup

| Field | Description |
|---|---|
| Management API URL | e.g. `http://localhost:15672` |
| Username / Password | Management credentials |
| Virtual Host | Default `/` |

### Qdrant Backup

| Field | Description |
|---|---|
| Host URL | e.g. `http://localhost:6333` |
| API Key | Leave empty for open instances |
| TLS / Skip Verify | Skip certificate verification |

## Node Options

| Option | Engines | Description |
|---|---|---|
| Compress (gzip) | MongoDB, PostgreSQL, RabbitMQ | Gzip before upload — reduces S3 storage cost |
| Include Schema | PostgreSQL | Include column definitions alongside data |
| Collections | Qdrant | Comma-separated collection names (empty = all) |
| Snapshot Wait (seconds) | Qdrant | Wait time for snapshot to build (default 30s) |

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