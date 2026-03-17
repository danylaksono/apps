import { require } from "npm:d3-require";
const d3 = require("d3", "d3-geo-projection");
const flubber = require("flubber@0.4");

// import flubber from "npm:flubber";

// import * as d3 from "npm:d3";

// import { geoProject } from "npm:d3-geo-projection";

export function inSituMorphMouse(options) {
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
  const context = DOM.context2d(
    restrictWidthToChart ? chartWH : width,
    chartWH
  );

  // let isSpacebarPressed = false;

  // document.addEventListener("keydown", (e) => {
  //   if (e.code === "Space") {
  //     isSpacebarPressed = true;
  //   }
  // });

  // document.addEventListener("keyup", (e) => {
  //   if (e.code === "Space") {
  //     isSpacebarPressed = false;
  //   }
  // });

  if (interactive) {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        console.log("space pressed");
        if (frame) cancelAnimationFrame(frame);
        isAnimating = false;
        const amtValue = (amtValue + 0.1) % 1; // increment by 0.1 on press, loop back to 0 when reaching 1
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

export const prepareGeoJsonForMorphingLib = function (
  geoJson,
  extentGeoJson,
  w,
  h
) {
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
