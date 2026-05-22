# n8n-nodes-backup-dbs

n8n community node to backup **RabbitMQ**, **MongoDB**, **PostgreSQL** and **Qdrant** directly to **Amazon S3**.

## Nodes (separate in the panel)

| Node | Description |
|---|---|
| **Backup MongoDB** | MongoDB → S3 |
| **Backup PostgreSQL** | PostgreSQL → S3 |
| **Backup Qdrant** | Qdrant → S3 |
| **Backup RabbitMQ** | RabbitMQ → S3 |

Search **Backup DBs** in the node panel to see all four under category **Backup DBs**.

## Credentials

| Credential | Used for |
|---|---|
| MongoDB Backup | **Backup MongoDB** node |
| PostgreSQL Backup | **Backup PostgreSQL** node |
| Qdrant Backup | **Backup Qdrant** node |
| RabbitMQ Backup | **Backup RabbitMQ** node |
| **S3 Backup Storage** | All backup nodes (destination) |

Each backup node has **Database** + **Amazon S3** credential slots.

## Node options

| Option | Engines |
|---|---|
| Backup File Name | All (default: today's date) |
| Database scope | MongoDB, PostgreSQL |
| Collection scope | Qdrant |
| Compress (gzip) | MongoDB, PostgreSQL, RabbitMQ |

## Installation

Settings → Community Nodes → Install → `n8n-nodes-backup-dbs-rsd`

## Local development

```bash
npm install
npm run build
export N8N_CUSTOM_EXTENSIONS=/path/to/n8n-backup-dbs
n8n start
```
