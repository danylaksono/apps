---
theme: dashboard
title: a simple year picker
toc: false
sidebar: false
footer: ""
---

<link
  rel="stylesheet"
  href="./components/yearpicker/yearpicker.css"
>

<style>
body, html {
  height: 100%;
  margin: 0 !important;
  /* overflow: hidden; */
  padding: 0;
}

#observablehq-main, #observablehq-header, #observablehq-footer {
    margin: 0 !important;
    /* width: 100% !important; */
    max-width: 100% !important;
}
</style>

```js
import { YearPicker } from "./components/yearpicker/yearpicker.js";
console.log(YearPicker);
```

```js
function useState(value) {
  const state = Mutable(value);
  const setState = (value) => (state.value = value);
  return [state, setState];
}
const [selected, setSelected] = useState({});
```

<div id="year-picker"></div>

```js
const container = document.querySelector("#year-picker");
const picker = new YearPicker(container, {
    allowQuickJump: true,
    onSelect: (year) => {
        console.log(`Year selected: ${year}`)
        setSelected(year);
        },
  });
```

```js
display(selected);
```


