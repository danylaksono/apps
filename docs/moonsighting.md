---
theme: dashboard
title: Moonsighting
toc: false
sidebar: false
---

<style>

.grid {
  margin: 5px;
}

#map-container {
  width: 100%;
  height: 500px;// 100vh; // Use vh for viewport height
  /* padding: 6px; */
}

#loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
}

#progressBar {
  width: 300px;
  height: 20px;
  margin-bottom: 20px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

</style>

<link rel="shortcut icon" href="/images/favicon.png">
<link href="https://unpkg.com/maplibre-gl@2.1.9/dist/maplibre-gl.css" rel="stylesheet" />

<!-- Library Preparations -->

```js
import { calculate } from "./components/calculate.js";
import { getMoonImageURLs } from "./components/moon-now.js";
import * as Astronomy from "npm:astronomy-engine@2.1.19";
import maplibregl from "npm:maplibre-gl@2.0.0";
import { Mutable } from "npm:@observablehq/stdlib";
import { moment } from "npm:moment";
```

```js
const grids = FileAttachment("./data/grids_025.geojson").json();
```

```js
const coords = Mutable([]);
const coordsSetter = (lat, lon) => {
  coords.value = [lat, lon];
};
```

```js
const dateInput = Inputs.date({
  label: "Select Date: ",
  submit: true,
  value: new Date(),
});
const date = Generators.input(dateInput);

// Object.assign(dateInput, {
//   oninput: (event) => event.isTrusted && event.stopImmediatePropagation(),
//   // oninput: (event) => {
//   //   console.log("event fired", event);
//   //   // showLoadingSpinner();
//   //   //event.currentTarget.dispatchEvent(new Event("input")),
//   // },
// });
```

<!-- INPUTS -->

```js
const modeInput = Inputs.radio(["Odeh", "Yallop"], {
  label: "Criteria: ",
  value: "Yallop",
  disabled: true,
});
const mode = Generators.input(modeInput);

const elevInput = Inputs.text({
  label: "Elevation (m): ",
  value: "100",
});
const elev = Generators.input(elevInput);
```

```js
const calculateDetails = () => {
  const lat = coords ? coords[0] : -7.983889;
  const lon = coords ? coords[1] : 110.323125;
  const elevation = parseFloat(elev);
  const code = calculate(lat, lon, elevation, date, {
    yallop: mode == "Yallop" ? true : false,
  });
  return code;
};
```

# Moonsighting 🌛

<div class="grid grid-cols-1" style="max-height:60px;">
  <div class="card" style="padding:6px;">
    <div class="grid grid-cols-3">
    <div>
    <div>
    <span> Select date and submit to draw the moon's visibility map. Click on the map to get the visibility calculation for that location. Adjust the elevation if needed. </span>
    </div>
    <span>Only Yallop method is available for now. </span>
    </div>
    <div>
    ${modeInput}
    ${elevInput}
    ${dateInput}
    </div>
    <div>
    ${coords ? calculateDetails().qcode : ''}
    </div>

  </div>
</div>

<div class="grid grid-cols-4" >
  <div class="card grid-colspan-3" style="padding:6px;">
    <div id="loading-container">
    <span id="loadingSpinner" class="spinner"></span>
    </div>
    <!-- maps -->
    <div id="map-container"></div>
  </div>
    <div class="card">
    <figure style="max-width: 100%;">
      <img id="myImage" width="300" height="300" style="aspect-ratio: 1 / 1; height: auto;" />
      <figcaption>
      <div>
      <i> The moon on: ${date.toLocaleDateString('en-gb',{
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        )} </i>
        </div>
        <a href="https://svs.gsfc.nasa.gov/4955">Visualizations by Ernie Wright</a> at <a href="https://svs.gsfc.nasa.gov/">NASA Scientific Visualization Studio</a>. Code adapted from @forresto.
      </figcaption>
    </figure>
    <div>
    <span> 
      <i> Hilal visibility on: ${date.toISOString().slice(0, 10)} </i>
        <span> ${coords? coords[0]: ''} | ${coords? coords[1]:''} </span>
    </div>
  </div>
</div>

<!-- Helper Functions -->

```js
function getCellColor(qcode) {
  let color;
  if (!isLoadingSpinnerVisible()) {
    showLoadingSpinner();
  }
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
// Function to show the loading spinner
function showLoadingSpinner() {
  const loadingSpinner = document.getElementById("loading-container");
  loadingSpinner.style.display = "block";
}

// Function to hide the loading spinner
function hideLoadingSpinner() {
  const loadingSpinner = document.getElementById("loading-container");
  loadingSpinner.style.display = "none";
}

// Function to check if the loading spinner is visible
function isLoadingSpinnerVisible() {
  const loadingContainer = document.getElementById("loading-container");
  const computedStyle = window.getComputedStyle(loadingContainer);
  const displayValue = computedStyle.getPropertyValue("display");

  return displayValue !== "none";
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
    const elev = 0;
    const code = calculate(lat, lon, elev, selectedDate, {
      yallop: mode == "Yallop" ? true : false,
    });
    // console.log(code.qcode);
    const cellColor = getCellColor(code.qcode);
    // hideLoadingSpinner();
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
  [93.216, -12.922],
  [143.07, 7.738],
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

// Watch for the 'data' event on the GeoJSON source
// map.on("render", (e) => {
//   console.log("GeoJSON data is loading");
//   console.log(e);
//   showLoadingSpinner();
// });

map.on("data", (e) => {
  if (e.sourceId === "mygeojson" && e.isSourceLoaded) {
    console.log("GeoJSON data has finished loading");
    hideLoadingSpinner();
    // You can perform additional actions here, such as showing a loading indicator
  }
});

invalidation.then(() => map.remove());
```

---

```js
const moonImageURLs = getMoonImageURLs(date, true);
const image = document.querySelector("#myImage");
image.src = moonImageURLs.jpg;
```

<!-- Render the data -->
