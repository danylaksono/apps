---
theme: dashboard
title: Investigate duckdb on client
toc: false
sidebar: false
footer: ""
sql:
  geo: ./data/geo.csv
  census_data_source: ./data/census_data_output.parquet
---

<!-- ------------------ # Imports ------------------  -->

## Investigate duckdb on client - using built in Framework

```js
// import { DuckDBClient } from "/components/duckdb.js";
import {DuckDBClient} from "npm:@observablehq/duckdb";
// import * as duckdb from "npm:@duckdb/duckdb-wasm";
// const duckdb = import(
//   "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm"
// );
```

```js
display(duckdb.PACKAGE_VERSION);
```

```js
const db = await DuckDBClient.of();

await db.sql`INSTALL spatial; LOAD spatial;`;
```

```js
display(
  Array.from(
    await db.sql([
      `CREATE OR REPLACE TABLE countises AS (
  select st_point(0,0) as geom, '0' as name
)`,
    ])
  )
);
```

```js
await db.sql([
  `CREATE OR REPLACE TABLE counties AS (
  FROM ST_Read('https://cdn.jsdelivr.net/npm/@d3ts/us-atlas@1/counties-10m.json')
)`,
]);
```

```js
const counties = Array.from(
  await db.sql`
SELECT *
       REPLACE (ST_AsGeoJSON(geom) AS geom)
     , ST_Area(ST_Transform(geom, 'NULL', 'ESRI:54034')) as area
  FROM counties
`,
  ({ geom, ...properties }) => Object.assign(JSON.parse(geom), { properties })
);
```
