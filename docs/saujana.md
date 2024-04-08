---
theme: dashboard
title: Saujana
toc: false
sidebar: false
---

<style>

#map-container {
  width: 100%;
  height: 400px;// 100vh; // Use vh for viewport height
}

</style>

# Moonsighting 🌛

<!-- Load and transform the data -->

<link href="https://unpkg.com/maplibre-gl@2.1.9/dist/maplibre-gl.css" rel="stylesheet" />

```js
import { calculate } from "./components/calculate.js";
import { getMoonImageURLs } from "./components/moon-now.js";
import * as Astronomy from "npm:astronomy-engine@2.1.19";
import maplibregl from "npm:maplibre-gl@2.0.0";
import { Mutable } from "npm:@observablehq/stdlib";
```

```js
const coords = Mutable([]);
const coordsSetter = (lat, lon) => {
  coords.value = [lat, lon];
};
```

```js
const dateInput = Inputs.date({
  label: "Tanggal: ",
  // submit: true,
  value: new Date(),
});
const date = Generators.input(dateInput);

const runInput = Inputs.button("Hitung");
const run = Generators.input(runInput);
```

```js
run;
const calculateDetails = () => {
  const lat = coords[0];
  const lon = coords[1];
  const code = calculate(lat, lon, date, {
    evening: true,
    yallop: true,
  });
  return code;
};
```

```js
run;
display(calculateDetails().qcode);
```

```js
const grids = FileAttachment("./data/grids_025.geojson").json();
```

## Calculate

<div class="grid grid-cols-1">
  <div class="card">
  ${dateInput}

${runInput}

  <div> 
  ${coords[0]} | ${coords[1]}
  </div>
  </div>
</div>

<div class="grid grid-cols-1" >
  <div class="card" style="padding:6px">
    <div id="map-container"></div>
    <div>
    <i> Hilal visibility on: ${date.toISOString().slice(0, 10)} </i>
    </div>
  </div>
</div>

```js
run;
const isrun = run ? true : false;
display(isrun);
```

```js
function getCellColor(qcode) {
  let color;

  if (qcode === "A") color = "rgba(62, 255, 0, 255)";
  else if (qcode === "B") color = "rgba(62, 255, 109, 255)";
  else if (qcode === "C") color = "rgba(0, 255, 158, 255)";
  else if (qcode === "D") color = "rgba(0, 255, 250, 255)";
  else if (qcode === "E") color = "rgba(60, 120, 255, 255)";
  else if (qcode === "F") color = "rgba(0, 0, 0, 255)";
  else if (qcode === "G") color = "rgba(173, 13, 106, 255)";
  else if (qcode === "H") color = "rgba(0, 0, 0, 255)";
  else if (qcode === "I") color = "rgba(0, 0, 255, 255)";
  else if (qcode === "J") color = "rgba(87, 7, 181, 255)";
  else color = null;

  return color;
}
```

```js
const gridData = {
  type: grids.type,
  features: grids.features.map((feature) => {
    const lat = feature.properties.lat;
    const lon = feature.properties.long;
    // console.log(lat, lon);
    const selectedDate = date; // new Date("2024-04-09T00:00:00Z");
    const code = calculate(lat, lon, selectedDate, {
      evening: true,
      yallop: true,
    });
    // console.log(code.qcode);
    const cellColor = getCellColor(code.qcode);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        color: cellColor,
      },
    };
  }),
};
```

```js
const map = new maplibregl.Map({
  boxZoom: true,
  pitch: 0,
  bearing: 0,
  maplibreLogo: true,
  container: "map-container",
  center: [110, -7],
  zoom: 12,
  style:
    "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
  // see more: https://deck.gl/docs/api-reference/carto/basemap
  scrollZoom: true,
});

map.on("load", function () {
  map.addSource("mygeojson", {
    type: "geojson",
    data: gridData,
  });

  map.addLayer({
    id: "mygeojson",
    type: "fill",
    source: "mygeojson",
    paint: {
      "fill-color": ["get", "color"],
      // "fill-outline-color": ["get", "color"],
      "fill-opacity": 0.5,
      "fill-antialias": false,
      // "line-opacity": 0,
    },
  });
});

map.fitBounds([
  [82.476562, -18.620677],
  [149.229492, 13.009439],
]);

let currentMarker = null;
map.on("click", (e) => {
  // Remove the previous marker if it exists
  if (currentMarker !== null) {
    currentMarker.remove();
  }

  // set the coords
  coordsSetter(e.lngLat.lat, e.lngLat.lng);

  // Create a new marker
  currentMarker = new maplibregl.Marker().setLngLat(e.lngLat).addTo(map);
});

invalidation.then(() => map.remove());
```

---

<!-- Moon Image Now -->

## Moon Image Now

<div class="grid grid-cols-1">
  <div class="card">
    <figure style="max-width: 100%;">
      <img id="myImage" width="400" height="400" style="aspect-ratio: 1 / 1; height: auto;" />
      <!-- <figcaption>
        <a href="https://svs.gsfc.nasa.gov/4955">Visualizations by Ernie Wright</a> at <a href="https://svs.gsfc.nasa.gov/">NASA Scientific Visualization Studio</a>, Released on November 18, 2021.
        <a href="${display(moonImageURLs.tif)}">👁 HD version (11MB .tif)</a>
      </figcaption> -->
    </figure>

  </div>
</div>

```js
const moonImageURLs = getMoonImageURLs(new Date(), true);
const image = document.querySelector("#myImage");
image.src = moonImageURLs.jpg;
```

<!-- Render the data -->
