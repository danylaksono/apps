---
theme: dashboard
title: React
toc: false
sidebar: false
---

```js
import { React, createElement } from "npm:react";
import { createRoot } from "npm:react-dom";
import { Mutable } from "npm:@observablehq/stdlib";
import { MultiSelect, MantineProvider } from "npm:@mantine/core";
import { ReactFlow } from "npm:reactflow";
```

```js
import { Grid } from "npm:@mantine/core";
```

# Using React in Observable Framework

source: https://github.com/observablehq/framework/discussions/1095

<link rel="stylesheet" href="npm:@mantine/core/styles.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reactflow@11.11.3/dist/style.min.css">
<link rel="stylesheet" href="npm:@mantine/core/styles.css" />

<div id="root"></div>

Selected values: ${selected.join(', ')}

```js
const root = createRoot(document.getElementById("root"));
```

```js
function useState(value) {
  const state = Mutable(value);
  const setState = (value) => (state.value = value);
  return [state, setState];
}
const [selected, setSelected] = useState(["react"]);
```

```js
root.render(
  createElement(
    MantineProvider,
    {},
    createElement(MultiSelect, {
      label: "your favorite libraries",
      placeholder: "pick value",
      data: ["react", "angular", "vue", "svelte"],
      value: selected,
      clearable: true,
      searchable: true,
      onChange: setSelected,
    })
  )
);
```

```js
function Demo() {
  return (
    <Grid>
      <Grid.Col span={4}>1</Grid.Col>
      <Grid.Col span={4}>2</Grid.Col>
      <Grid.Col span={4}>3</Grid.Col>
    </Grid>
  );
}
```
