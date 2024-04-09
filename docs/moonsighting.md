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


/* Style the tab */
.tab {
  overflow: hidden;
  border: 1px solid #ccc;
  background-color: #f1f1f1;
}

/* Style the buttons that are used to open the tab content */
.tab button {
  background-color: inherit;
  float: left;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 14px 16px;
  transition: 0.3s;
}

/* Change background color of buttons on hover */
.tab button:hover {
  background-color: #ddd;
}

/* Create an active/current tablink class */
.tab button.active {
  background-color: #ccc;
}

/* Style the tab content */
.tabcontent {
  display: none;
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-top: none;
}

</style>

<link rel="shortcut icon" href="/images/favicon.png">
<link href="https://unpkg.com/maplibre-gl@2.1.9/dist/maplibre-gl.css" rel="stylesheet" />

<!-- Library Preparations -->

```js
import { calculate } from "./components/calculate.js";
import { geocode } from "./components/geocoder.js";
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

function formatDate(date) {
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h12",
  };
  const timeString = date.toLocaleTimeString("en-US", { hour12: true });
  const dateString = date.toLocaleDateString("en-US", options);

  return `${dateString}, ${timeString}`;
}

function formatDuration(duration) {
  const hours = Math.floor(duration);
  const minutes = Math.floor((duration - hours) * 60);
  const seconds = Math.floor(((duration - hours) * 60 - minutes) * 60);

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

const duration = 0.9821;
const formattedDuration = formatDuration(duration);
console.log(formattedDuration); // Output: "00:59:00"
```

# Moonsighting 🌛

<div class="grid grid-cols-1" style="max-height:60px;">
  <div class="card" style="padding:6px;">
    <div class="grid grid-cols-3">
    <div>
    <div>
    <span> Select date and submit to draw the moon's visibility map. Click on the map to get the visibility calculation for that location. Adjust the elevation if needed. </span>
    </div>
    <span>Only <a href="https://webspace.science.uu.nl/~gent0113/islam/islam_lunvis_method.htm">Yallop</a> method is available for now. </span>
    </div>
    <div>
    ${modeInput}
    ${elevInput}
    ${dateInput}
    </div>
    <div>
      <div>
        <h1> Criteria: ${ coords[0] ? calculateDetails().qcode : ''} </h1>
      <div>
        <h3> ( ${coords[0] ? yallop[calculateDetails().qcode] : ''} ) </h3>
      </div>
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
  <div class="card" style="max-height:500px;">
    <div class="tab">
      ${html`<button class="tablinks active" onclick=${(event) => openTab(event, 'firsttab')}>Image</button>`}
      ${html`<button class="tablinks" onclick=${(event) => openTab(event, 'secondtab')}>Details</button>`}
    </div>
    <div id="firsttab" class="tabcontent" style="display: block;">
      <figure style="max-width: 100%;">
        <img id="myImage" width="250" height="250" style="aspect-ratio: 1 / 1; height: auto;" />
        <figcaption>
          <div>
            <i> ${date.toLocaleDateString('en-gb',{ year: 'numeric', month: 'long', day: 'numeric' })} <a href="https://svs.gsfc.nasa.gov/4955">- Credit: Ernie Wright</a> at <a href="https://svs.gsfc.nasa.gov/">NASA Scientific Visualization Studio</a> & <a href="https://observablehq.com/@forresto/the-moon-now"> @forresto </a></i>
          </div>
        </figcaption>
      </figure>
    </div>
    <div id="secondtab" class="tabcontent">
      <p><i>Clicked Location Detail:</i></p>
      <p>Lat: ${coords[0] ? coords[0].toFixed(5) : ''}, Long: ${coords[1] ? coords[1].toFixed(5) : ''}</p>
      <p>Lag Time: ${coords[0] ? formatDuration((calculateDetails().lagTime).toFixed(4)) : ''}</p>
      <p>Moon set: ${coords[0] ? formatDate(calculateDetails().moonsetMoonrise) : ''}</p>
      <p>Sun set: ${coords[0] ? formatDate(calculateDetails().sunsetSunrise) : ''}</p>
      <p>New Moon: ${coords[0] ? formatDate(calculateDetails().newMoonPrev) : ''}</p>
      <p>Moon Semi-Diameter: ${coords[0] ? calculateDetails().sdTopo : ''}</p>
      <p>Elongation (Arc of Light): ${coords[0] ? calculateDetails().arcl : ''}</p>
    </div>
<div style="font-color:'grey'; font-size:0.8em; padding:0;">
  <hr style="padding-top:8px; padding-bottom:4px; margin:2px;">
  <p style="margin-bottom: 0.2rem;">Dashboard and crescent visibility calculation in JS by <a href="https://github.com/danylaksono">@danylaksono</a></p>
  <p style="margin-top: 0.2rem; margin-bottom: 0.2rem;">Credits:</p>
  <p style="margin-top: 0.2rem; margin-bottom: 0.2rem;">- <a href="https://github.com/cosinekitty/astronomy">Astronomy Engine</a></p>
  <p style="margin-top: 0.2rem; margin-bottom: 0.2rem;">- <a href="https://github.com/crescent-moon-visibility/crescent-moon-visibility/">Crescent Moon Visibility in C++</a></p>
  <p style="margin-top: 0.2rem; margin-bottom: 0.2rem;">- <a href="https://observablehq.com/framework">Observable Framework</a></p>
  <p style="margin-top: 0.2rem;"> This is a work in progress and might not reflect the actual conditions. Please refer to the official calculation methods for crescent visibility </p>
</div>
  </div>
</div>

<!-- Helper Functions -->

```js
function openTab(event, tabName) {
  // Get all elements with class="tabcontent" and hide them
  const tabcontents = document.querySelectorAll(".tabcontent");
  tabcontents.forEach((tabcontent) => {
    tabcontent.style.display = "none";
  });

  // Get all elements with class="tablinks" and remove the class "active"
  const tablinks = document.querySelectorAll(".tablinks");
  tablinks.forEach((tablink) => {
    tablink.classList.remove("active");
  });

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabName).style.display = "block";
  event.currentTarget.classList.add("active");
}
```

```js
function getCellColor(qcode) {
  let color;
  if (!isLoadingSpinnerVisible()) {
    showLoadingSpinner();
  }
  if (qcode === "A") color = "rgb(1,255,1)";
  else if (qcode === "B") color = "rgb(127,255,0)";
  else if (qcode === "C") color = "RGB(127,255,127)";
  else if (qcode === "D") color = "RGB(255,255,0)";
  else if (qcode === "E") color = "RGB(255,127,76)";
  else if (qcode === "F") color = "rgba(0, 0, 0, 0)";
  else if (qcode === "G") color = "RGB(178,0,178)";
  else if (qcode === "H") color = "rgba(0, 0, 0, 255)";
  else if (qcode === "I") color = "RGB(255,0,0)";
  else if (qcode === "J") color = "rgba(0, 0, 0, 0)";
  else color = null;

  return color;
}
```

```js
// Yallop criteria lookup
const yallop = {
  A: "Hilal easily visible",
  B: "Hilal visible under perfect conditions",
  C: "May need optical aid to find crescent",
  D: "Will need optical aid to find crescent",
  E: "Crescent not visible with telescope",
  F: "Hilal not visible - below the Danjon limit (7°)",
  G: "Hilal not visible - Sunset is before new moon", //
  H: "Hilal not visible - No Moonset on location", //
  I: "Hilal not visible - Moonset before sunset",
};
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

```js
const moonImageURLs = getMoonImageURLs(date, true);
const image = document.querySelector("#myImage");
image.src = moonImageURLs.jpg;
```

<!-- Render the data -->
