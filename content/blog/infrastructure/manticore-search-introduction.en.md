---
title: "Practical Experience Applying Manticore Search Engine"
tags:
  - "manticore-search"
  - "search-engine"
  - "elasticsearch"
  - "full-text-search"
  - "kubernetes"
date: '2025-11-25'
---

Hello, I am Jeongil, a backend developer working on a PropTech platform.

"We need a search function."

When developers hear this, one name likely pops into their heads: **Elasticsearch**. Thanks to its powerful features and rich ecosystem, it's considered the industry standard.

But is Elasticsearch always the right answer? "Do we really need to set up Kibana and battle with Java heap memory just to add a single search feature?" Our team had to ponder this question deeply.

Especially in resource-constrained environments, the high resource requirements and complexity of Elasticsearch can be a significant burden.

At the end of this deliberation, we discovered an open-source search engine called **Manticore Search**. This post records our realistic concerns, experiences, and the technical decision-making process of choosing Manticore Search as an alternative to Elasticsearch and applying it to a production environment.

## Manticore Search?

Manticore Search is a high-performance open-source full-text search engine written in C++. However, it wasn't a completely new project, which was interesting.

Its roots lie in **Sphinx Search**, which gained popularity in the early 2000s alongside MySQL for its lightweight and fast performance. In 2016, when Sphinx development virtually ceased, most of the core development team left to fork the project in 2017, creating Manticore Search.

What's intriguing is that while Sphinx later turned closed-source, Manticore Search has maintained its 100% open-source status and is developing much more actively. ([*Manticore Search: 3 years after forking from Sphinx*](https://manticoresearch.com/blog/manticore-search-3-years-after-forking-from-sphinx/))

## Realistic Reasons Why We Chose Manticore Search

I believe technology selection is always a series of trade-offs. Here is the process our team went through to choose Manticore Search.

### 1. Realistic Constraint: Server Costs and Resources

The biggest reason was **cost**. Elasticsearch is Java-based, and for a production environment, at least 8GB RAM and 2 vCPUs are recommended. This was excessive for our service scale and directly translated to infrastructure cost burdens.

On the other hand, Manticore Search, written in C++, showed amazing efficiency, using only **about 40MB of RSS** for an empty instance. We are operating the feature stably in a Kubernetes environment with specs around `requests: cpu: 200m, memory: 512Mi`. This difference is negligible for large enterprises but significant for small teams like startups or SMEs.

### 2. Performance: Does Light Mean Fast?

Just as important as cost was **performance**. According to the latest benchmarks released by Manticore Search, they claim to be **several to tens of times** faster than Elasticsearch, especially in scenarios like log analysis. ([*Manticore Search vs Elasticsearch*](https://manticoresearch.com/comparison/vs-elasticsearch/))

Of course, benchmarks are results from ideal environments. However, we expected that Manticore's architecture—written in C++ and using system resources directly without overheads like JVM Garbage Collection (GC)—would provide 'predictable and consistent performance'.

In fact, in our POI search environment, the **stability of showing consistently low latency under any circumstance** was more attractive than the 'how many times faster' metric. The absence of the 'stuttering' caused by Full GC, which can occasionally be experienced in Elasticsearch, gave us great psychological peace of mind.

### 3. Developer Productivity: SQL and HTTP

One of Manticore Search's biggest attractions was its **native SQL support**. It is compatible with the MySQL protocol, allowing us to connect directly with existing MySQL clients and write search queries in familiar SQL.

```sql
-- You can use SQL like this instead of Elasticsearch's JSON DSL.
SELECT * FROM poi WHERE MATCH('Gangnam Station');
```

![manticore-sql](https://previews.dropbox.com/p/thumb/AC0kqDEVDa7csrXvSzUz2xHBR9uymklifI1x9l8Tgfk6UocD5P_JW9MT2IEbGRZfXbK_g9WWqui_Rhe6QuNRP2AH3HvV9n7OA7Ayv8nZm7Gbr2dIBIqd7UIcJIa5LiznytDeRLZ2F6pMojG7b5LjlIgtsP1VBZ8Io6ZuZQI_aYjZYJjdqvlunbCM7dNhYzfrhtE3thmMzEePvH_dxRXCfWRsSHnmtBSH6eyaA0YjWIAWnkTDvQx65iegTLDOEoA38Z2th7jIZm-Hf7HHzl8EixjMzBcU9q2Ndy0H6wEQrQiUVzf7cIC37ZC11iu3v3aOLnxQl2juWKmYAs4iC63roZFd/p.png?is_prewarmed=true)

Furthermore, it natively supports **HTTP JSON API**, which is essential for modern web service architectures.

```bash
# Example of HTTP API search request using curl
curl -X POST 'http://127.0.0.1:9308/search' -H 'Content-Type: application/json' -d "{
    "index": "poi",
    "query": {
        "match": { "name": "Gangnam Station" }
    }
}"
```

![manticore-http](https://previews.dropbox.com/p/thumb/AC2xnivdJx2UdgNROejy01d1_6ZgHt4pPKDHOnT-Umd6NI5sA-H2bWgVifYUfg6Mi5Lwjm5qL3QUPIbXJZcWjZk4dfd9IA0qB8akuLjq61nqC4_QtQt6GuvPsHlFhcz4UYhd6WeFVzhLLwckEzZqkAT4fxaOTJhhnFigyQRzIJotZN1mRCHIbaLQLFMPPI1ByjfCfLUeikNQ9PkP1nI_os3e1FI-FxbfHi_SNI7Y7_1he4_bOZqPB4DEWXKonrlH1rkbuhbBmZytz38xphqZ59Kc4n0kmY9nddcHPUXbGvdvKTOkUeF6yuYX4MVIOrnQSJmjckYyJ9BxX8XX_8uMLfbj/p.png?is_prewarmed=true)

## Comparison with Other Search Engines: Why Manticore?

Besides Elasticsearch, we also reviewed other lightweight search engines like **Meilisearch** and **Typesense**.

| Feature | Manticore Search | Meilisearch | Typesense | Elasticsearch |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | C++ | Rust | C++ | Java |
| **Data Sync** | **Pull** (DB → Engine) | **Push** (App → Engine) | **Push** (App → Engine) | **Push** (App/Logstash → Engine) |
| **Pros** | Native SQL, Low Resources | Easy to use, Fast dev | Fast (In-Memory) | Rich Ecosystem, Analytics |
| **Cons** | Small ecosystem | Scale limits | RAM limits | High Resources, Complex |

Elasticsearch, Meilisearch, and Typesense are all optimized for the **Push** method, where the application calls APIs to send data. In contrast, Manticore's `Plain` index was more specialized for the **Pull** method, where an `indexer` periodically fetches data from the DB to recreate the index.

Our requirement was that **"when specific tables in the operational DB change, they should be periodically reflected in the search engine."** To use the Push model in this case, we would need to implement separate synchronization logic in the application to detect DB changes and call the API. However, Manticore's Pull model delegates this process to the search engine, allowing us to keep the application logic simple, which we judged to be more suitable for us.

Below are diagrams showing the difference between the two data synchronization methods.

#### Push Model
> In the `Push` model, the responsibility for data synchronization lies with the **Application**. The application must detect DB changes and call the search engine's API to push the data.
> For example, this could be implemented with a service like Spring Batch.

```mermaid
graph LR;
  style App fill:#f9f,stroke:#333,stroke-width:2px
  DB[(Database)] -- "1. Data Changed" --> App{Application<br/>w/ Sync Logic};
  App -- "2. Push Data" --> SE[Search Engine<br/>(ES, Meili, ..)];
```

#### Pull Model
> In the `Pull` model, the responsibility for data synchronization lies with the **Search Engine**. The application only handles search requests, and Manticore Search's `Indexer` periodically fetches (Pulls) data from the DB to keep the index up to date.

```mermaid
graph LR;
  style MS fill:#ccf,stroke:#333,stroke-width:2px
  DB[(Database)];
  App{Application<br/>(Search Only)} -- "Search Query" --> MS[Manticore Search];
  MS -- "Pulls Data Periodically" --> DB;
```

## Production Deployment and Indexing Automation

Now I will share how we deployed Manticore Search in a real production environment and automated indexing using two methods: **Docker Compose** and **Kubernetes**.

### Method 1: Configuring Development Environment with Docker Compose

For local development environments or single-server deployments, using Docker Compose is very convenient. Here is a simplified example of the configuration we actually used.

#### 1. `docker-compose.yml`

```yaml {filename="docker-compose.yml"}
version: '3.8'

services:
  manticore:
    build:
      context: .
      dockerfile: Dockerfile.manticore
    container_name: manticore
    restart: unless-stopped
    ports:
      - "9306:9306" # MySQL protocol
      - "9308:9308" # HTTP API
    volumes:
      # Share data, config, logs with host for persistence
      - ./manticore-data:/var/lib/manticore
      - ./manticore.conf:/etc/manticoresearch/manticore.conf
      - ./manticore-logs:/var/log/manticore
    # Increase file descriptor limits for large-scale search to prevent performance issues
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
```

```conf {filename="manticore.conf"}
# 1. searchd daemon basic settings
searchd {
    listen              = 9306:mysql41 # MySQL protocol
    listen              = 9308:http    # HTTP API port
    pid_file            = /var/run/manticore/searchd.pid
    log                 = /var/log/manticore/searchd.log
    query_log           = /var/log/manticore/query.log
}

# 2. Data Source settings example
source poi_src
{
    type            = mysql
    sql_host        = YOUR_DB_HOST
    sql_user        = YOUR_DB_USER
    sql_pass        = YOUR_DB_PASSWORD
    sql_db          = YOUR_DB_NAME
    sql_query       = \
        SELECT station_id AS id, station_name, line_name \
        FROM station_table_example
    sql_attr_string = line_name
}

# 3. Index settings example
index poi {
    source          = poi_src
    path            = /var/lib/manticore/poi
    # --- Key settings for Korean search ---
    charset_table   = 0..9, A..Z->a..z, a..z
    infix_fields    = station_name
    min_infix_len   = 2
    ngram_len       = 2
    ngram_chars     = U+AC00..U+D7AF, U+1100..U+11FF, U+3130..U+318F
}
```

#### 2. `Dockerfile.manticore` & `start.sh`

Set up `cron` inside the Manticore container to automate indexing.

```dockerfile {filename="Dockerfile"}
# Dockerfile.manticore
FROM manticoresearch/manticore:latest

# Install cron and create log file
RUN apt-get update && apt-get install -y cron && \
    touch /var/log/manticore/cron.log

# Configure cron job (Refresh index every hour)
RUN echo "0 * * * * indexer poi --config /etc/manticoresearch/manticore.conf --rotate >> /var/log/manticore/cron.log 2>&1 && mysql -h 127.0.0.1 -P9306 -e \"RELOAD INDEXES;\" >> /var/log/manticore/cron.log 2>&1" > /etc/cron.d/manticore-indexer
RUN chmod 0644 /etc/cron.d/manticore-indexer
RUN crontab /etc/cron.d/manticore-indexer

# Copy start script and grant permissions
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

```bash {filename="start.sh"}
# start.sh
#!/bin/bash
set -e

# Start cron service
service cron start

# Run Manticore in foreground
exec searchd --nodetach
```

This method has the advantage of managing all infrastructure settings as code (IaC) and easily building an identical development environment with a single `docker-compose up` command.

---

### Method 2: Deploying to Production with Kubernetes

This is how we configured our actual production environment. We assigned the responsibility of indexing automation to the **Manticore container itself**, rather than using a Kubernetes `CronJob`. This was to unify all deployment-related responsibilities into a single `Deployment` for easier management.

#### 1. `manticore.conf` (ConfigMap Example)

Configured concisely with **one source and one index** to match the blog example.

```yaml {filename="configmap.yaml"}
apiVersion: v1
kind: ConfigMap
metadata:
  name: manticore-search-config
data:
  manticore.conf: |
    # 1. searchd daemon basic settings
    searchd {
        listen              = 9306:mysql41 # MySQL protocol
        listen              = 9308:http    # HTTP API port
        pid_file            = /var/run/manticore/searchd.pid
        log                 = /var/log/manticore/searchd.log
        query_log           = /var/log/manticore/query.log
    }

    # 2. Data Source settings example
    source poi_src
    {
        type            = mysql
        sql_host        = YOUR_DB_HOST
        sql_user        = YOUR_DB_USER
        sql_pass        = YOUR_DB_PASSWORD
        sql_db          = YOUR_DB_NAME
        sql_query       = \
            SELECT station_id AS id, station_name, line_name \
            FROM station_table_example
        sql_attr_string = line_name
    }

    # 3. Index settings example
    index poi {
        source          = poi_src
        path            = /var/lib/manticore/poi
        # --- Key settings for Korean search ---
        charset_table   = 0..9, A..Z->a..z, a..z
        infix_fields    = station_name
        min_infix_len   = 2
        ngram_len       = 2
        ngram_chars     = U+AC00..U+D7AF, U+1100..U+11FF, U+3130..U+318F
    }
```

#### 2. `Dockerfile` and `start.sh`

Even in the Kubernetes environment, we use a `Dockerfile` and `start.sh` similar to the Docker Compose method to build an image where the container handles indexing scheduling itself. The key is adding **initial indexing logic** to `start.sh`.

```dockerfile {filename="Dockerfile"}
# Dockerfile
FROM manticoresearch/manticore:latest

# Install cron, flock(util-linux)
RUN apt-get update && apt-get install -y cron util-linux

# Configure cron job (Includes logging and prevents duplicate execution)
RUN echo "0 * * * * /usr/bin/flock -n /var/run/manticore-indexer.lock /bin/bash -c '...' " > /etc/cron.d/manticore-indexer

COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

```bash {filename="start.sh"}
# start.sh (Improved version)
#!/bin/bash
set -e

service cron start

# If index file doesn't exist when Pod starts (solving Cold Start problem), run initial indexing
if [ ! -f /var/lib/manticore/poi.sph ]; then
    echo "No existing index found. Running initial indexing..."
    indexer poi --config /etc/manticoresearch/manticore.conf
fi

exec searchd --nodetach
```

#### 3. `Deployment.yaml`

```yaml {filename="deployment.yaml"}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: manticore-search-prod
spec:
  replicas: 2
  template:
    spec:
      # Grant ownership of volume to Manticore process (uid 999) before container starts
      initContainers:
        - name: init-permissions
          image: busybox:1.36
          command: ["sh", "-c", "chown -R 999:999 /var/lib/manticore"]
          volumeMounts:
            - name: manticore-data
              mountPath: /var/lib/manticore
      containers:
        - name: manticore-search
          image: YOUR_CUSTOM_MANTICORE_IMAGE:TAG
          ports:
            - containerPort: 9306
            - containerPort: 9308
          volumeMounts:
            - name: manticore-data
              mountPath: /var/lib/manticore
            - name: manticore-search-config
              mountPath: /etc/manticoresearch/manticore.conf
              subPath: manticore.conf
          resources:
            requests:
              cpu: 200m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
          # Liveness: Restart if container doesn't respond
          livenessProbe:
            tcpSocket: { port: 9306 }
            initialDelaySeconds: 30
          # Readiness: Do not accept service traffic until probe succeeds
          readinessProbe:
            tcpSocket: { port: 9306 }
            initialDelaySeconds: 10
```

## Korean Search, The Journey of Trials and Errors

During the Korean tokenization process, we pondered over the `ngram_len` value. While official documentation often recommends `ngram_len=1`, analyzing our dataset characteristics and main search terms revealed that two-character searches like 'Gangnam' or 'Seocho' were more natural and accurate. Thus, we finally decided on **`ngram_len=2`** (cutting by 2 characters).

I believe it's important to find settings that fit your service by analyzing actual data and user search patterns rather than following a set answer.

## Issues We Encountered

1.  **Initial Indexing Slowness**: The cause was **Source DB's `sql_query` performance**. We solved it by tuning the query and adding indexes.
2.  **Absence of Kibana**: We are considering integration with Grafana, etc., but haven't found a satisfactory visualization/monitoring solution yet.
3.  **Mixed Korean+English/Number Search**: Solved by including English and numbers in `charset_table`.

## Conclusion: The Journey of Choosing the Right Tool for the Problem

Our team started with the realistic problems of cost and complexity and found an excellent alternative in Manticore Search.

If you don't need all the features provided by Elasticsearch, I believe Manticore Search can be a powerful alternative that allows you to implement excellent search functions with much less cost and effort.

Since there aren't many references for Manticore Search in Korea, I hope this post helps those considering its adoption. If you have any questions or find any incorrect information, please feel free to leave a comment!

## Epilogue: Back to the Embrace of Elasticsearch

Since the time of writing this post, there has been another change in our team's tech stack. We eventually decided to choose Elasticsearch. Although we were satisfied with Manticore Search, the technical requirements changed during the process of **building a new RAG (Retrieval-Augmented Generation) system**.

In terms of embedding vector search, which is the core of the RAG system, and future scalability, we judged that the rich features and ecosystem provided by Elasticsearch were more advantageous.

However, if your goal is still strictly **'light and fast search'** and you are looking for a tool that supports `Pull` based indexing, I still believe Manticore Search is a great option.

I think Elasticsearch is a better tool for our new requirement of 'complex and diverse search support (ex. embedding-based similarity search and multi-parameter search)'. (In this process, indexing was implemented via Spring Batch as mentioned above.)

I will cover the experience of migrating from Manticore Search to Elasticsearch and the story of building the RAG system in detail in another post next time.

## Reference

- [Manticore Search Official Site](https://manticoresearch.com/)
- [Manticore Search GitHub](https://github.com/manticoresoftware/manticoresearch)
- [Manticore Search vs Elasticsearch Comparison](https://manticoresearch.com/comparison/vs-elasticsearch/)(https://manticoresearch.com/comparison/vs-elasticsearch/)
- [Manticore Search Manual - NLP and tokenization](https://manual.manticoresearch.com/Creating_a_table/NLP_and_tokenization)
- [db-benchmarks.com - Independent Database Benchmarks](https://db-benchmarks.com)
