---
theme: dashboard
title: Histograms
toc: false
sidebar: false
---

```js
import { Histogram } from './components/histogram/histogram.js';
```


<style>
.histogram-tooltip {
    font-family: Arial;
    font-size: 12px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    padding: 5px;
    background: white;
    border: 1px solid #ccc;
    position: absolute;
    pointer-events: none;
}

</style>

```js
const data = [
  { age: 25, date: new Date(2023, 0, 1), category: 'A' },
  { age: 30, date: new Date(2023, 1, 15), category: 'B' },
  { age: 35, date: new Date(2023, 2, 10), category: 'A' },
  { age: 40, date: new Date(2023, 3, 5), category: 'C' },
  { age: 45, date: new Date(2023, 4, 20), category: 'B' },
  { age: 50, date: new Date(2023, 5, 25), category: 'A' },
  { age: 55, date: new Date(2023, 6, 30), category: 'C' },
  { age: 60, date: new Date(2023, 7, 15), category: 'B' },
  { age: 65, date: new Date(2023, 8, 10), category: 'A' },
  { age: 70, date: new Date(2023, 9, 5), category: 'C' },
];
```

<div id="histogram-container"></div>
<button id="clear-selection">Clear Selection</button>
<button id="reset-histogram">Reset Histogram</button>

```js
const histogram = new Histogram({
  width: 600,
  height: 400,
  column: 'age',
  colors: ['steelblue', 'orange'],
  selectionMode: 'multiple',
//   axis: true,
  showLabelsBelow: true, // Enable labels below the histogram
}).initialize('#histogram-container');

// set data
histogram.update(data);
```


```js
histogram.on('selectionChanged', selectedData => {
  console.log('Selected data:', selectedData);
  display(selectedData)
});
// display(selectedData);
```

```js
document.getElementById('clear-selection').addEventListener('click', () => {
  histogram.clearSelection();
});

document.getElementById('reset-histogram').addEventListener('click', () => {
  histogram.reset();
});
```


