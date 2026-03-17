---
theme: dashboard
title: Morphing Glyphmaps
toc: false
sidebar: false
footer: ""
sql:
  geo: ./data/geo.csv
  census_data_source: ./data/census_data_output.parquet
---

<!-- ------------------ # Imports ------------------  -->

```js
import * as turf from "@turf/turf";
// import * as d3 from "npm:d3";
import { require } from "npm:d3-require";
const d3 = require("d3", "d3-geo-projection");
const flubber = require("flubber@0.4");
import { RadialGlyph } from "./components/radialglyph.js";
import {
  glyphMap,
  createDiscretiserValue,
  _drawCellBackground,
} from "./components/gridded-glyphmaps/index.min.js";
import { OSGB } from "./components/osgb/index.js";
import {
  downloadBoundaries,
  joinCensusDataToGeoJSON,
  convertGridCsvToGeoJson,
  context2d,
} from "./components/utils.js";
// import {
//   inSituMorphMouse,
//   prepareGeoJsonForMorphingLib,
// } from "./components/morpher.js";
```

```js
const proj = new OSGB();
```

<!-- ------------ The HTML Layout ------------ -->

<!-------- Stylesheets -------->
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
>

<style>
body, html {
  height: 100%;
  margin: 0 !important;
  overflow: hidden;
  padding: 0;
}

#observablehq-main, #observablehq-header, #observablehq-footer {
    margin: 0 !important;
    /* width: 100% !important; */
    max-width: 100% !important;
}

</style>

<div id="left-panel" class="grid grid-cols-4" style="padding:8px; height:92vh;">
    <div class="card grid-colspan-1">
         <div style="padding:10px;"> ${localAuthorityInput} </div>
         <div style="padding:10px;"> ${geogNameInput} </div>
         <div style="padding:10px;"> ${glyphmapTypeInput} </div>
         <div style="padding:10px;"> <small>Drag to morph (choose 'Gridmap')</small> ${tInput} </div>  
        <hr>
        <div style="padding:10px;"> List of layers</div>
    </div>
    <div id="main-panel" class="card glyphmaps grid-colspan-3" style="padding:8px; height:92vh;">
     ${resize((width, height) => createGlyphMap(glyphmapType, {width, height}))}
    </div>
    <div id="right-panel" class="grid-colspan-1" style="display: flex; flex-direction: column; padding:8px; height:92vh;">
        <div class="card" style="flex-grow: 1;">
          Glyph view here
        </div>
        <div class="card" style="flex-grow: 1;">
            <div style="padding:15px;">Animated morphing glyphmaps</div>
            <div>
                ${Plot.geo(dataInMorph).plot({projection: { type: "identity", domain: dataInMorph }})}
            </div>
        </div>
    </div>
</div>

<!-- ------------------ # Data and Inputs ------------------  -->

<!-- Select the Local authority from the list below -->

```js
const localAuthorityInput = Inputs.select(
  [...list_la].map((item) => item.label),
  {
    value: "Bradford",
    label: "Local Authority:",
  }
);
const local_authority = Generators.input(localAuthorityInput);
```

```js
const geogNameInput = Inputs.radio(["LSOA", "MSOA"], {
  value: "MSOA",
  label: "Geography",
});

const geogName = Generators.input(geogNameInput);
// display(geogName);
```

```js
const tInput = html`<input
  style="width: 100%; max-width:200px;"
  type="range"
  step="0.05"
  min="0"
  max="1"
/>`;

const t = Generators.input(tInput);
```

```js
const la_code = [...list_la].find((row) => row.label === local_authority).code;
const geogBoundary = geogName.toLowerCase() + "s";
```

```sql id=list_la
select distinct label, code from geo where geography = 'LA' order by label
```

```sql id=list_of_codes
SELECT code
FROM geo
WHERE geo.geography = (SELECT replace(${geogName}, '"', ''''))
AND geo.LA = (SELECT replace(${la_code}, '"', ''''))
```

```js
const list_of_code = [...list_of_codes].map((row) => row.code);
const regular_geodata = await downloadBoundaries(geogBoundary, list_of_code);
// display(regular_geodata);
```

```js
async function convertGridIfExists(filename, bb) {
  // take from stored preprocessed grids for now
  // future version will use the grid generation code
  const gridPath = `https://www.danylaksono.com/datasets/cartogram/${filename}.csv`;

  try {
    const gridCsv = await d3.csv(gridPath);
    return convertGridCsvToGeoJson(gridCsv, bb);
  } catch (error) {
    // console.log(`Grid file ${filename}.csv not found or couldn't be loaded.`);
    return error;
  }
}

const filename = `${local_authority.toLowerCase()}_${geogBoundary}_grids`;
const bb = turf.bbox(regular_geodata);

// display(filename);

const grid_geodata = await convertGridIfExists(filename, bb);
if (grid_geodata instanceof Error) {
  display("Grid file not found or couldn't be loaded.");
  // return;
}
// display(bb);
// display(grid_geodata);
```

```sql id=census_data
--  Load the census data --
select * from census_data_source;
```

<!-- ------------------ # Morphing Geometry Functions ------------------  -->

```js
// normalise the data
function normalizeValue(paramName, value) {
  const values = regular_geodata_withcensus.features.map(
    (feature) => feature.properties[paramName]
  );
  const min = d3.min(values);
  const max = d3.max(values);

  return (value - min) / (max - min);
}

const data = _.keyBy(
  regular_geodata_withcensus.features.map((feat) => {
    return {
      code: feat.properties.code,
      population: +feat.properties.population,
      data: feat.properties,
      deprivation: normalizeValue(
        "deprivation_value",
        feat.properties.deprivation_value
      ),
      vehicle: normalizeValue("vehicle_value", feat.properties.vehicle_value),
      heating: normalizeValue("heating_value", feat.properties.heating_value),
      health: normalizeValue("health_value", feat.properties.health_value),
    };
  }),
  "code"
);
// display(data);
```

```js
// display(
//   prepareGeoJsonForMorphingLib(regular_geodata, regular_geodata, 300, 300)
// );
```

```js
const colourScalePop = d3
  .scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(Object.values(data).map((row) => row.population))]);

const layouts = [
  {
    shapes: prepareGeoJsonForMorphingLib(
      regular_geodata,
      regular_geodata,
      200,
      200
    ),
    colourFn: (key) => colourScalePop(data[key].population),
    description: local_authority + " " + geogName + " Choropleth Map.",
  },
  {
    shapes: prepareGeoJsonForMorphingLib(
      grid_geodata,
      regular_geodata,
      200,
      200
    ),
    colourFn: (key) => colourScalePop(data[key].population),
    description: local_authority + " " + geogName + "Gridmaps.",
  },
];

// const morphers = inSituMorphMouse({
//   interactive: true,
//   showDescription: false,
//   layouts,
// });
```

```js
// using observable framework resize callback function
// const morphers = resize((width, height) =>
//   inSituMorphMouse(
//     {
//       interactive: true,
//       showDescription: false,
//       layouts2,
//       width,
//     },
//     width
//   )
// );

// display(morphers);
```

<!-- ------------------ # Morphing Geometry Functions ------------------  -->

```js
const extractCoordinatesForFlubber = (features) => {
  return features.map((feature) => {
    const { type, coordinates } = feature.geometry;

    if (type === "Polygon") {
      return coordinates[0]; // Use the first ring in the polygon
    } else if (type === "MultiPolygon") {
      return coordinates.flat(2); // Flatten MultiPolygon into a single array of points
    } else {
      throw new Error(`Unsupported geometry type: ${type}`);
    }
  });
};

const interpolateGeoShapes = (geography, cartogram, w, h) => {
  const geogProjected = prepareGeoJsonForMorphingLib(
    geography,
    geography,
    w,
    h
  );
  const cartProjected = prepareGeoJsonForMorphingLib(
    cartogram,
    geography,
    w,
    h
  );

  const geogCoords = extractCoordinatesForFlubber(Object.values(geogProjected));
  const cartCoords = extractCoordinatesForFlubber(Object.values(cartProjected));

  // console.log("geogCoords", geogCoords);

  const interpolator = flubber.interpolateAll(geogCoords, cartCoords, {
    string: false,
    single: true,
  });

  return (t) => {
    const interpolatedCoords = interpolator(t);
    return Object.keys(geogProjected).reduce((acc, code, index) => {
      acc[code] = {
        ...geogProjected[code],
        geometry: {
          ...geogProjected[code].geometry,
          coordinates: [interpolatedCoords[index]],
        },
      };
      return acc;
    }, {});
  };
};

function convertToGeoJSON(interpolatedShapes) {
  // console.log("interpolatedShapes", interpolatedShapes);
  return {
    type: "FeatureCollection",
    features: Object.entries(interpolatedShapes).map(([code, feature]) => ({
      type: "Feature",
      properties: {
        ...feature.properties,
        code: code,
      },
      geometry: {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
      },
    })),
  };
}
```

```js
function createGeometryInverter(originalGeography, width, height) {
  // Create the same projection used in the original transformation
  const projection = d3
    .geoIdentity()
    .reflectY(true)
    .fitExtent(
      [
        [0, 0],
        [width, height],
      ],
      originalGeography
    );

  // Create the inverse function
  const inverseProjection = projection.invert;

  // Function to invert a single coordinate pair
  const invertCoordinate = (coord) => inverseProjection(coord);

  // Function to invert an array of coordinates (for Polygons)
  const invertPolygon = (coords) =>
    coords.map((ring) => ring.map(invertCoordinate));

  // Function to invert MultiPolygon coordinates
  const invertMultiPolygon = (coords) => coords.map(invertPolygon);

  // Main inversion function
  return function invertGeometry(projectedGeometry) {
    const { type, coordinates } = projectedGeometry;

    switch (type) {
      case "Polygon":
        return {
          type: "Polygon",
          coordinates: invertPolygon(coordinates),
        };
      case "MultiPolygon":
        return {
          type: "MultiPolygon",
          coordinates: invertMultiPolygon(coordinates),
        };
      default:
        throw new Error(`Unsupported geometry type: ${type}`);
    }
  };
}
```

```js
function invertIntGeoShapes(intGeoShapes, t) {
  const projectedShapes = intGeoShapes(t);
  return Object.fromEntries(
    Object.entries(projectedShapes).map(([code, feature]) => [
      code,
      {
        ...feature,
        geometry: invertGeometry(feature.geometry),
      },
    ])
  );
}
```

```js
const intGeoShapesv2 = interpolateGeoShapes(
  regular_geodata_withcensus,
  grid_geodata_withcensus,
  3000,
  3000
);
const dataInMorph = convertToGeoJSON(intGeoShapesv2(t));
// display(Object.values(intGeoShapesv2(t)));
// display(dataInMorph);
```

```js
const invertGeometry = createGeometryInverter(
  regular_geodata_withcensus,
  3000,
  3000
);
```

```js
const geographicShapes = invertIntGeoShapes(intGeoShapesv2, t);
// display(Object.values(geographicShapes));
```

```js
// const transformedGeographicShapes = {
//   ...Object.values(geographicShapes),
//   features: Object.values(geographicShapes).map((feature) => ({
//     ...feature,
//     geometry: {
//       ...feature.geometry,
//       coordinates: transformCoordinates(feature.geometry.coordinates),
//     },
//   })),
// };
// display(transformedGeographicShapes);
```

```js
// const geographicDataInMorph = convertToGeoJSON(transformedGeographicShapes);
// display(geographicDataInMorph);
```

```js
// ---------------------- Functions for morphing ----------------------

function inSituMorphMouse(options, width) {
  //interactive: true|false Whether responds to mouse for animation
  //layouts: is an array of layouts with the following structure
  //   shape: {key,feature}
  //   colourFn: (key)=>colour
  //   staggered: EITHER true/false OR function (key)=> delay (delay based on values' keys) OR an object with indivDelayFn an indivDuration
  let layouts = options.layouts;
  let interactive = options.interactive;
  let showDescription = options.showDescription;
  let restrictWidthToChart = options.restrictWidthToChart;
  let isAnimating = false;
  let curStepAndAmt = 0; //only use as read only
  let frame;
  layouts = _insertIntermediateLayouts(layouts); //also parses the string shortcuts

  let thisSelectorFn = () => false;
  let thisSelectorColour = d3.color("red");

  //work out which are fades and which are tweens
  const transitions = [];
  for (let i = 0; i < layouts.length - 1; i++) {
    // console.log(layouts[i].shapes);
    // console.log(layouts[i + 1].shapes);
    if (
      _.intersection(
        Object.keys(layouts[i].shapes),
        Object.keys(layouts[i + 1].shapes)
      ).length > 0
    )
      transitions.push("tween");
    else transitions.push("fade");
  }

  //find bb of the union of all shapes
  const bb = turf.bbox(
    turf.featureCollection(
      _.flatten(
        layouts
          .map((layout) => layout.shapes)
          .map((shape) => Object.values(shape))
      )
    )
  );

  const chartWH = bb[3];

  const throttled = _.throttle((stepAndAmt) => draw(stepAndAmt), 100);
  // const context = context2d(restrictWidthToChart ? chartWH : width, chartWH);
  const context = context2d(
    width || (restrictWidthToChart ? chartWH : options.width),
    chartWH
  );
  // const context = DOM.context2d(
  //   restrictWidthToChart ? chartWH : width,
  //   chartWH
  // );

  if (interactive) {
    let amtValue = 0; // initialize amtValue
    let increasing = true; // direction flag to track the direction of change
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        // console.log("Spacebar pressed");
        if (frame) cancelAnimationFrame(frame);
        isAnimating = false;

        if (increasing) {
          amtValue += 0.1;
          if (amtValue >= 1) {
            amtValue = 1;
            increasing = false;
          }
        } else {
          amtValue -= 0.1;
          if (amtValue <= 0) {
            amtValue = 0;
            increasing = true;
          }
        }

        throttled(amtValue);
      }
    });
  }

  // if (interactive)
  //   context.canvas.addEventListener("mousemove", (e) => {
  //     if (e.shiftKey) {
  //       if (frame) cancelAnimationFrame(frame);
  //       isAnimating = false;
  //       const mouseX = d3.pointer(e)[0];
  //       const amtValue = _.clamp(Math.min(mouseX, chartWH) / chartWH, 0, 1);
  //       throttled(amtValue);
  //     }
  //   });

  //Calculate all the necessary flubber interpolators for everything
  const flubbers = [];
  for (let i = 0; i < layouts.length - 1; i++) {
    flubbers.push(
      Object.fromEntries(
        _.intersection(
          Object.keys(layouts[i].shapes),
          Object.keys(layouts[i + 1].shapes)
        ).map((key) => [
          key,
          flubber.interpolate(
            d3.geoPath()(layouts[i].shapes[key]),
            d3.geoPath()(layouts[i + 1].shapes[key]),
            { string: false }
          ),
        ])
      )
    );
  }

  function calcStepAndAmt(amtValue) {
    let transitionDurations = layouts
      .slice(0, -1)
      .map((row) => (row.transitionDuration ? row.transitionDuration : 1));
    let maxAmt = d3.sum(transitionDurations);

    let st = 0;
    let i = 0;
    let cumDur = 0;
    while (cumDur + transitionDurations[i] < maxAmt * amtValue) {
      cumDur += transitionDurations[i];
      i++;
    }
    let step = i;
    let amt = (amtValue * maxAmt - cumDur) / transitionDurations[i];
    if (step >= layouts.length - 1) {
      step = layouts.length - 1;
      amt = 1;
    }
    return [step, amt];
  }

  function draw(amtValue) {
    const stepAndAmt = calcStepAndAmt(amtValue);
    const step = stepAndAmt[0];
    const amt = stepAndAmt[1];
    curStepAndAmt = amtValue;
    if (transitions[step] == "tween") animateShapes(step, amt);
    else fadeShapes(step, amt);

    if (showDescription) {
      context.font = "14px serif";
      const colour = d3.color("black");
      for (let i = 0; i < layouts.length; i++) {
        if (i == step)
          colour.opacity = 1 - d3.scaleLinear([0, 1], [0.1, 1])(amt);
        else if (i == step + 1)
          colour.opacity = d3.scaleLinear([0, 1], [0.1, 1])(amt);
        else colour.opacity = 0.1;

        context.fillStyle = colour;
        context.fillText(
          layouts[i].description ? layouts[i].description : "",
          chartWH,
          i * 14 + 14
        );
      }
    }
  }

  function animateShapes(layoutIdx, amt) {
    context.clearRect(0, 0, width, chartWH);
    let keys = _.intersection(
      (Object.keys(layouts[layoutIdx].shapes),
      Object.keys(layouts[layoutIdx + 1].shapes))
    );
    let maxDelay = 1;
    if (layouts[layoutIdx].staggered === true) maxDelay = keys.length;
    else if (layouts[layoutIdx].staggered) {
      if (_.isFunction(layouts[layoutIdx].staggered)) {
        maxDelay = d3.max(keys, (key) => layouts[layoutIdx].staggered(key));
      } else if (
        layouts[layoutIdx].staggered.indivDelayFn &&
        _.isFunction(layouts[layoutIdx].staggered.indivDelayFn)
      ) {
        maxDelay = d3.max(keys, (key) =>
          layouts[layoutIdx].staggered.indivDelayFn(key)
        );
      }
    }
    let dur = maxDelay;
    if (
      layouts[layoutIdx].staggered &&
      layouts[layoutIdx].staggered.indivDuration
    )
      dur = layouts[layoutIdx].staggered.indivDuration;
    maxDelay += dur; //This makes sure the last duration is animated

    if (thisSelectorFn) {
      keys = _.sortBy(keys, (key) => thisSelectorFn(key));
    }

    let i = 0;
    for (const key of keys) {
      let indivDelay = 0;
      if (layouts[layoutIdx].staggered === true) indivDelay = i;
      else if (layouts[layoutIdx].staggered) {
        if (_.isFunction(layouts[layoutIdx].staggered))
          indivDelay = layouts[layoutIdx].staggered(key);
        else if (_.isFunction(layouts[layoutIdx].staggered.indivDelayFn))
          indivDelay = layouts[layoutIdx].staggered.indivDelayFn(key);
      }

      let combinedAmt = amt;
      if (layouts[layoutIdx].staggered) {
        combinedAmt = _.clamp(
          d3.scaleLinear(
            [indivDelay / maxDelay, (indivDelay + dur) / maxDelay],
            [0, 1]
          )(amt),
          0,
          1
        );
      }

      const cs = flubbers[layoutIdx][key](combinedAmt);
      context.beginPath();
      d3.geoPath().context(context)(turf.polygon([[...cs, cs[0]]]));

      let colour = 0;
      if (thisSelectorFn && thisSelectorFn(key)) {
        colour = thisSelectorColour;
      } else {
        const fromColour = layouts[layoutIdx].colourFn
          ? layouts[layoutIdx].colourFn(key)
          : "#ddd";
        const toColour = layouts[layoutIdx + 1].colourFn
          ? layouts[layoutIdx + 1].colourFn(key)
          : "#ddd";
        colour = d3.interpolateRgb(fromColour, toColour)(amt);
      }
      context.fillStyle = colour;
      context.fill();
      i++;
    }
  }

  function fadeShapes(layoutIdx, amt) {
    context.clearRect(0, 0, width, chartWH);
    for (const key of Object.keys(layouts[layoutIdx].shapes)) {
      context.beginPath();
      d3.geoPath().context(context)(layouts[layoutIdx].shapes[key]);
      context.fillStyle =
        thisSelectorFn && thisSelectorFn(key)
          ? thisSelectorColour
          : layouts[layoutIdx].colourFn(key);
      context.fill();
    }

    const offScreen = new OffscreenCanvas(chartWH, chartWH);
    const offScreenContext = offScreen.getContext("2d");

    offScreenContext.beginPath();
    d3.geoPath().context(offScreenContext)(
      turf.bboxPolygon([0, 0, width, chartWH])
    );
    offScreenContext.fillStyle = "rgb(255,255,255)";
    offScreenContext.fill();

    for (const key of Object.keys(layouts[layoutIdx + 1].shapes)) {
      offScreenContext.beginPath();
      d3.geoPath().context(offScreenContext)(
        layouts[layoutIdx + 1].shapes[key]
      );
      offScreenContext.fillStyle =
        thisSelectorFn && thisSelectorFn(key)
          ? thisSelectorColour
          : layouts[layoutIdx + 1].colourFn(key);

      offScreenContext.fill();
    }
    context.globalAlpha = amt;
    context.drawImage(offScreen, 0, 0);
    context.globalAlpha = 1;
  }

  draw(0);

  context.canvas.highlightShapes = (
    selectorFn,
    selectorColour = "rgb(230, 195, 73)"
  ) => {
    thisSelectorFn = selectorFn;
    thisSelectorColour = selectorColour;
    draw(curStepAndAmt);
  };

  context.canvas.draw = (amtValue) => draw(amtValue);

  context.canvas.animate = (inc) => {
    if (frame) cancelAnimationFrame(frame);
    isAnimating = true;
    let forward = true;
    let st = curStepAndAmt;
    function tick() {
      if (forward) {
        st += inc;
        if (st > 1) {
          st = 1;
          forward = false;
        }
      }
      if (!forward) {
        st -= inc;
        if (st < 0) {
          st = 0;
          forward = true;
        }
      }
      if (isAnimating) {
        draw(st);
        frame = requestAnimationFrame(tick);
      } else cancelAnimationFrame(frame);
    }
    requestAnimationFrame(tick);
  };

  return context.canvas;
}

function _insertIntermediateLayouts(layouts) {
  //first insert the intermediate layouts
  const newLayouts = [];
  //first insert intermediate layouts
  for (let i = 0; i < layouts.length - 1; i++) {
    if (layouts[i].staged) {
      if (!_.isArray(layouts[i].staged))
        layouts[i].staged = [layouts[i].staged];
      const intermediateLayouts = [];
      let prevShapes = layouts[i].shapes;
      const numStages = layouts[i].staged.length;
      for (const intermediateSpec of layouts[i].staged) {
        let newShapes;
        if (_.isFunction(intermediateSpec)) {
          newShapes = intermediateSpec(
            prevShapes,
            layouts[i + 1].shapes,
            layouts[i].shapes
          );
          prevShapes = newShapes;
        } else {
          for (const intermediateSpecPart of intermediateSpec.split("&")) {
            if (intermediateSpecPart == "translateX")
              newShapes = intermTranslate(
                prevShapes,
                layouts[i + 1].shapes,
                "x"
              );
            if (intermediateSpecPart.startsWith("translateX=")) {
              const amount = +intermediateSpecPart.split("=")[1];
              // console.log(amount);
              newShapes = intermTranslateV(prevShapes, [amount, 0]);
            } else if (intermediateSpecPart == "translateY")
              newShapes = intermTranslate(
                prevShapes,
                layouts[i + 1].shapes,
                "y"
              );
            else if (intermediateSpecPart == "translate")
              newShapes = intermTranslate(prevShapes, layouts[i + 1].shapes);
            else if (intermediateSpecPart == "changeShapeCircle")
              newShapes = intermCircles(prevShapes, 10);
            else if (intermediateSpecPart == "changeShape")
              newShapes = intermChangeShape(prevShapes, layouts[i + 1].shapes);
            else if (intermediateSpecPart == "changeShapeOriginal")
              newShapes = intermChangeShape(prevShapes, layouts[i].shapes);
            else if (intermediateSpecPart == "changeBbSize")
              newShapes = intermBbSize(prevShapes, layouts[i + 1].shapes);
            else if (intermediateSpecPart == "changeBbSizeOriginal")
              newShapes = intermBbSize(prevShapes, layouts[i].shapes);
            if (newShapes) prevShapes = newShapes;
          }
        }
        if (newShapes) {
          intermediateLayouts.push({
            ...layouts[i],
            shapes: newShapes,
            transitionDuration: layouts[i].transitionDuration
              ? layouts[i].transitionDuration / numStages
              : undefined,
          });
          prevShapes = newShapes;
        }
      }
      newLayouts.push(layouts[i]);
      newLayouts.push(...intermediateLayouts);
    } else {
      newLayouts.push(layouts[i]);
    }
  }
  newLayouts.push(layouts[layouts.length - 1]);
  return newLayouts;
}

function intermTranslate(layout, toLayout, type = "xy") {
  const centroids = _.mapValues(toLayout, (value) =>
    turf.getCoord(turf.centroid(value))
  );
  return _.mapValues(layout, (value, key) => {
    const centroid1 = turf.getCoord(turf.centroid(value));
    const centroid2 = centroids[key];

    if (type == "xy")
      return d3.geoProject(
        value,
        d3
          .geoIdentity()
          .translate([centroid2[0] - centroid1[0], centroid2[1] - centroid1[1]])
      );
    else if (type == "x")
      return d3.geoProject(
        value,
        d3.geoIdentity().translate([centroid2[0] - centroid1[0], 0])
      );
    else if (type == "y")
      return d3.geoProject(
        value,
        d3.geoIdentity().translate([0, centroid2[1] - centroid1[1]])
      );
  });
}

const prepareGeoJsonForMorphingLib = function (geoJson, extentGeoJson, w, h) {
  if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
    console.error("GeoJSON features are not ready yet");
    return {};
  }

  const polyFeats = d3.geoProject(
    geoJson,
    d3
      .geoIdentity()
      .reflectY(true)
      .fitExtent(
        [
          [0, 0],
          [w, h],
        ],
        geoJson
      )
  );
  return _.keyBy(
    polyFeats.features.map((feat) => feat),
    (feat) => feat.properties.code
  );
};

function intermTranslateV(layout, xy) {
  return _.mapValues(layout, (value, key) => {
    const centroid1 = turf.getCoord(turf.centroid(value));

    return d3.geoProject(value, d3.geoIdentity().translate(xy));
  });
}

function intermCircles(layout, radius, align) {
  const steps = 20;
  return _.mapValues(layout, (value, key) => {
    const bb = turf.bbox(value);
    let circleCentre;
    if (align == "topLeft") circleCentre = [bb[0], bb[1]];
    else if (align == "topRight") circleCentre = [bb[2], bb[1]];
    else if (align == "bottomRight") circleCentre = [bb[2], bb[3]];
    else if (align == "bottomLeft") circleCentre = [bb[0], bb[3]];
    else if (align == "top")
      circleCentre = [bb[0] + (bb[2] - bb[0]) / 2, bb[1]];
    else if (!align || align == "centre")
      circleCentre = [bb[0] + (bb[2] - bb[0]) / 2, bb[1] + (bb[3] - bb[1]) / 2];
    // console.log(circleCentre);
    const circleCoords = [];
    //https://stackoverflow.com/questions/155649/circle-coordinates-to-array-in-javascript
    for (let i = 0; i < steps; i++) {
      circleCoords.push([
        circleCentre[0] + radius * Math.cos((2 * Math.PI * i) / steps),
        circleCentre[1] + radius * Math.sin((2 * Math.PI * i) / steps),
      ]);
    }
    circleCoords.push(circleCoords[0]);
    return turf.polygon([circleCoords]);
  });
}

function intermChangeShape(layout, toLayout) {
  const centroids = _.mapValues(layout, (value) =>
    turf.getCoord(turf.centroid(value))
  );
  return _.mapValues(toLayout, (value, key) => {
    const shapeCentroid = turf.getCoord(turf.centroid(value));
    const targetCentroid = centroids[key];
    if (targetCentroid)
      return d3.geoProject(
        value,
        d3
          .geoIdentity()
          .translate([
            targetCentroid[0] - shapeCentroid[0],
            targetCentroid[1] - shapeCentroid[1],
          ])
      );
  });
}

function intermBbSize(layout, toLayout) {
  const bbs = _.mapValues(toLayout, (value) => turf.bbox(value));
  return _.mapValues(layout, (value, key) => {
    const toBbSize = bbs[key];
    const bb = turf.bbox(value);

    const toBbSizeW = toBbSize[2] - toBbSize[0];
    const toBbSizeH = toBbSize[3] - toBbSize[1];
    const bbW = bb[2] - bb[0];
    const bbH = bb[3] - bb[1];

    return d3.geoProject(
      value,
      d3.geoIdentity().fitExtent(
        [
          [bb[0] + bbW / 2 - toBbSizeW / 2, bb[1] + bbH / 2 - toBbSizeH / 2],
          [bb[0] + bbW / 2 + toBbSizeW / 2, bb[1] + bbH / 2 + toBbSizeH / 2],
        ],
        turf.bboxPolygon(bb)
      )
    );
  });
}
```

<!-- ------------------ # Gridded-Glyphmap Functions ------------------  -->

```js
// Coordinate transformation utilities
function transformCoordinates(coords) {
  if (coords.length === 4 && !Array.isArray(coords[0])) {
    // bounding box
    return [
      ...proj.toGeo([coords[0], coords[1]]),
      ...proj.toGeo([coords[2], coords[3]]),
    ];
  } else if (Array.isArray(coords[0])) {
    // arrays of coordinates
    return coords.map(transformCoordinates);
  } else {
    // individual coordinate pairs
    return proj.toGeo(coords);
  }
}

function transformGeometry(geometry) {
  if (geometry.type === "GeometryCollection") {
    return {
      ...geometry,
      geometries: geometry.geometries.map(transformGeometry),
    };
  }

  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates),
  };
}

// Function to apply transformation to geographicShapes
function applyTransformationToShapes(geographicShapes) {
  return Object.fromEntries(
    Object.entries(geographicShapes).map(([code, feature]) => [
      code,
      {
        ...feature,
        geometry: transformGeometry(feature.geometry),
      },
    ])
  );
}

// check to see if it works
// display(transformCoordinates([547764, 180871]));
```

```js
const transformedShapes = convertToGeoJSON(
  applyTransformationToShapes(geographicShapes)
);
// display(transformedShapes);
```

```js
// const regularGeodataLookup = _.keyBy(
//   regular_geodata_withcensus.features.map((feat) => {
//     return { ...feat, centroid: turf.getCoord(turf.centroid(feat.geometry)) };
//   }),
//   (feat) => feat.properties.code
// );

// const gridGeodataLookup = _.keyBy(
//   grid_geodata_withcensus.features.map((feat) => {
//     return { ...feat, centroid: turf.getCoord(turf.centroid(feat.geometry)) };
//   }),
//   (feat) => feat.properties.code
// );

const regularGeodataLookup = _.keyBy(
  regular_geodata_withcensus.features.map((feat) => {
    const transformedGeometry = transformGeometry(feat.geometry);
    const centroid = turf.getCoord(turf.centroid(transformedGeometry));
    return {
      ...feat,
      geometry: transformedGeometry,
      centroid: centroid,
    };
  }),
  (feat) => feat.properties.code
);

const gridGeodataLookup = _.keyBy(
  grid_geodata_withcensus.features.map((feat) => {
    const transformedGeometry = transformGeometry(feat.geometry);
    const centroid = turf.getCoord(turf.centroid(transformedGeometry));
    return {
      ...feat,
      geometry: transformedGeometry,
      centroid: centroid,
    };
  }),
  (feat) => feat.properties.code
);

// display(regularGeodataLookup);
```

```js
const glyphmapTypeInput = Inputs.radio(["Polygons", "Gridmap", "Gridded"], {
  label: "Type of map",
  value: "Polygons",
});
const glyphmapType = Generators.input(glyphmapTypeInput);

function valueDiscretiser(geomLookup) {
  return createDiscretiserValue({
    //... and adds a discretisation function that aggregates by CODE and supplies the polygons for each cell
    valueFn: (row) => {
      return row.code;
    },
    glyphLocationFn: (key) => geomLookup[key]?.centroid,
    boundaryFn: (key) => geomLookup[key]?.geometry.coordinates[0],
  });
}
```

```js
function valueDiscretiserInMorph(inp) {
  // create lookup on the fly
  let geomLookup = Object.fromEntries(
    inp.features.map((feature) => {
      const centroid = turf.centroid(feature).geometry.coordinates; // calculate centroid
      return [
        feature.properties.code,
        {
          ...feature,
          centroid, // store centroid
        },
      ];
    })
  );

  // console.log(geomLookup);

  return createDiscretiserValue({
    valueFn: (row) => row.code,
    glyphLocationFn: (key) => geomLookup[key]?.centroid, // Use the calculated centroid
    boundaryFn: (key) => geomLookup[key]?.geometry.coordinates[0], // Access the boundary (first set of coordinates)
  });
}

// display(valueDiscretiserInMorph(dataInMorph));
// display("datain morph");
// display(dataInMorph);
// display(transformCoordinates(turf.bbox(regular_geodata)));
```

```js
// glyphmap basic specs
function glyphMapSpec(width, height) {
  // console.log("in glyphmapspec", width, height);
  // const bbox = turf.bbox(regular_geodata);
  return {
    // coordType: "notmercator",
    initialBB: turf.bbox(transformedShapes),
    // initialBB: [
    //   ...proj.toGeo([bbox[0], bbox[1]]),
    //   ...proj.toGeo([bbox[2], bbox[3]]),
    // ],
    data: Object.values(data),
    getLocationFn: (row) => regularGeodataLookup[row.code]?.centroid,
    discretisationShape: "grid",
    mapType: "CartoPositron",
    interactiveCellSize: true,
    cellSize: 60,

    // width: 800,
    // height: 600,
    width: width,
    height: height,

    customMap: {
      scaleParams: [],

      initFn: (cells, cellSize, global, panel) => {},

      preAggrFn: (cells, cellSize, global, panel) => {
        // console.log(global);
      },

      aggrFn: (cell, row, weight, global, panel) => {
        if (cell.population) {
          cell.population += row.population;
          cell.deprivation += row.deprivation;
          cell.vehicle += row.vehicle;
          cell.heating += row.heating;
          cell.health += row.health;
        } else {
          cell.population = row.population;
          cell.deprivation = row.deprivation;
          cell.vehicle = row.vehicle;
          cell.heating = row.heating;
          cell.health = row.health;
        }
      },

      postAggrFn: (cells, cellSize, global, panel) => {
        //add cell interaction
        let canvas = d3.select(panel).select("canvas").node();

        canvas.addEventListener("click", function (evt) {
          //check which cell the click was in
          const rect = canvas.getBoundingClientRect();
          let x = evt.clientX - rect.left;
          let y = evt.clientY - rect.top;
          global.clickedCell = null;
          for (let i = 0; i < cells.length; i++)
            if (insideCell(cells[i], x, y)) global.clickedCell = cells[i];
        });
      },

      preDrawFn: (cells, cellSize, ctx, global, panel) => {
        if (!cells || cells.length === 0) {
          console.error("No cells data available");
          return;
        }
        global.pathGenerator = d3.geoPath().context(ctx);
        global.colourScalePop = d3
          .scaleSequential(d3.interpolateBlues)
          .domain([0, d3.max(cells.map((row) => row.population))]);
      },

      drawFn: (cell, x, y, cellSize, ctx, global, panel) => {
        const boundary = cell.getBoundary(0);
        if (boundary[0] != boundary[boundary.length - 1]) {
          boundary.push(boundary[0]);
        }
        const boundaryFeat = turf.polygon([boundary]);

        ctx.beginPath();
        global.pathGenerator(boundaryFeat);
        ctx.fillStyle = global.colourScalePop(cell.population);
        ctx.fill();

        //add contour to clicked cells
        if (global.clickedCell == cell) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgb(250,250,250)";
          ctx.stroke();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgb(50,50,50)";
          ctx.stroke();
        }

        //draw a radial glyph -> change the array to real data (between 0 and 1)
        drawRadialMultivariateGlyph([0.5, 0.1, 0.9, 0.3], x, y, cellSize, ctx);
        // drawRadialMultivariateGlyph(
        //   [cell.deprivation, cell.vehicle, cell.heating, cell.health],
        //   x,
        //   y,
        //   cellSize,
        //   ctx
        // );

        // let rg = new RadialGlyph([
        //   cell.deprivation,
        //   cell.vehicle,
        //   cell.heating,
        //   cell.health,
        // ]);
        // rg.draw(ctx, x, y, cellSize / 2);
      },

      postDrawFn: (cells, cellSize, ctx, global, panel) => {},

      tooltipTextFn: (cell) => {
        console.log(cell.deprivation);
      },
    },
  };
}
```

```js
function createGlyphMap(glyphmapType, { width, height }) {
  // console.log(width, height);
  if (glyphmapType == "Polygons") {
    return glyphMap({
      ...glyphMapSpec(width, height), //takes the base spec...
      discretiserFn: valueDiscretiser(regularGeodataLookup),
    });
  } else if (glyphmapType == "Gridmap") {
    return glyphMap({
      ...glyphMapSpec(width, height), //takes the base spec...
      discretiserFn: valueDiscretiserInMorph(transformedShapes),
    });
  } else if (glyphmapType == "Gridded") {
    return glyphMap(glyphMapSpec(width, height)); //uses the base spec as it (by default, it grids)
  }
}

const glyphmap = glyphMapSpec();

// display(createGlyphMap(glyphmapType));
// display(valueDiscretiser(regularGeodataLookup));
```

```js
// joining census data to geodata
const regular_geodata_withcensus = joinCensusDataToGeoJSON(
  [...census_data],
  regular_geodata
);
const grid_geodata_withcensus = joinCensusDataToGeoJSON(
  [...census_data],
  grid_geodata
);

// display(regular_geodata_withcensus);
```

```js
function drawRadialMultivariateGlyph(normalisedData, x, y, size, ctx) {
  let angle = (2 * Math.PI) / normalisedData.length;
  let centerX = x;
  let centerY = y;
  let radius = size / 2;
  // console.log(radius);

  //get a colour palette
  let colors = d3
    .scaleOrdinal(d3.schemeTableau10)
    .domain(d3.range(normalisedData.length));

  normalisedData.map((d, i) => {
    drawPieSlice(
      ctx,
      centerX,
      centerY,
      radius * 0.9,
      angle * (i + 0.1),
      angle * (i + 0.9),
      "rgba(0,0,0,0.05)"
    );
    drawPieSlice(
      ctx,
      centerX,
      centerY,
      radius * Math.sqrt(d) * 0.95,
      angle * (i + 0.1),
      angle * (i + 0.9),
      colors(i)
    );
  });
}
```

```js
function drawPieSlice(ctx, cx, cy, r, angleStart, angleEnd, color) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, angleStart, angleEnd);
  ctx.lineTo(cx, cy);
  ctx.fillStyle = color;
  ctx.fill();
}
```

```js
function insideCell(c, x, y) {
  // console.log(x + " " + y  + " " + c.getXCentre() + " " + c.getYCentre() + " " + c.getCellSize());
  if (
    x >= c.getXCentre() - c.getCellSize() &&
    x <= c.getXCentre() + c.getCellSize() &&
    y >= c.getYCentre() - c.getCellSize() &&
    y <= c.getYCentre() + c.getCellSize()
  )
    return true;
  return false;
}
```
