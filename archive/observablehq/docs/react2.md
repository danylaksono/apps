---
theme: dashboard
title: React2
toc: false
sidebar: true
---

# React

```js
import { React, createElement } from "npm:react";
import { createRoot } from "npm:react-dom";
// import { useState } from "npm:react";

import { useForm } from "npm:@mantine/form";
import {
  Grid,
  GridCol,
  MantineProvider,
  NumberInput,
  TextInput,
  Button,
} from "npm:@mantine/core";
```

<link rel="stylesheet" href="npm:@mantine/core/styles.css" />

```js echo
const root = createRoot(display(document.createElement("DIV")));
```

The code above creates a root; a place for React content to live. We render some content into the root below.

```js echo
root.render(
  createElement(
    MantineProvider,
    {},
    createElement(
      Grid,
      null,
      createElement(GridCol, { span: 4 }, "1"),
      createElement(GridCol, { span: 4 }, "2"),
      createElement(GridCol, { span: 4 }, "3")
    )
  )
);
```

```js
root.render(createElement(MantineProvider, {}, Demo()));
```

```js
function Demo() {
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { name: "", email: "", age: 0 },
    validate: {
      name: (value) =>
        value.length < 2 ? "Name must have at least 2 letters" : null,
      email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
      age: (value) =>
        value < 18 ? "You must be at least 18 to register" : null,
    },
  });

  return createElement(
    "form",
    { onSubmit: form.onSubmit(console.log) },
    createElement(TextInput, {
      label: "Name",
      placeholder: "Name",
      key: form.key("name"),
      ...form.getInputProps("name"),
    }),
    createElement(TextInput, {
      mt: "sm",
      label: "Email",
      placeholder: "Email",
      key: form.key("email"),
      ...form.getInputProps("email"),
    }),
    createElement(NumberInput, {
      mt: "sm",
      label: "Age",
      placeholder: "Age",
      min: 0,
      max: 99,
      key: form.key("age"),
      ...form.getInputProps("age"),
    }),
    createElement(Button, { type: "submit", mt: "sm" }, "Submit")
  );
}
```
