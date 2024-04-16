---
theme: [alt, wide]
title: Scrolly test
toc: false
sidebar: false
---

<script src="https://unpkg.com/scrollama"></script>

<style>
#scrolly {
  position: relative;
  display: flex;
  background-color: #f3f3f3;
  padding: 1rem;
}

#scrolly > * {
  flex: 1;
}

#article {
  position: relative;
  padding: 0 1rem;
}

#figure {
  position: -webkit-sticky;
  position: sticky;
  width: 100%;
  min-width: 70rem;
  margin: 0;
  -webkit-transform: translate3d(0, 0, 0);
  -moz-transform: translate3d(0, 0, 0);
  transform: translate3d(0, 0, 0);
  background-color: #8a8a8a;
  z-index: 0;
  flex-grow: 1;
}

#figure p {
    text-align: center;
    padding: 1rem;
    position: absolute;
    top: 50%;
    left: 50%;
    -moz-transform: translate(-50%, -50%);
    -webkit-transform: translate(-50%, -50%);
    transform: translate(-50%, -50%);
    font-size: 8rem;
    font-weight: 900;
    color: #fff;
}

.step {
    margin: 0 auto 2rem auto;
    background-color: #3b3b3b;
    color: #fff;
}

.step:last-child {
    margin-bottom: 0;
}

.step.is-active {
    background-color: goldenrod;
    color: #3b3b3b;
}

.step p {
    text-align: center;
    padding: 1rem;
    font-size: 1.5rem;
}
</style>

<main>
<section id="intro">
			<h1 class="intro__hed">Sticky Side Example</h1>
			<p class="intro__dek">
				Start scrolling to see how it works.
			</p>
		</section>
		<section id="scrolly" class="card">
            <div id="article">
                <div class="step" data-step="1">
                <p>STEP 1</p>
                </div>
                <div class="step" data-step="2">
                <p>STEP 2</p>
                </div>
                <div class="step" data-step="3">
                <p>STEP 3</p>
                </div>
                <div class="step" data-step="4">
                <p>STEP 4</p>
                </div>
            </div>
            <div id="figure">
                <p>0</p>
            </div>
            </section>
    	<section id="outro"></section>

</main>

```js
// using d3 for convenience
var main = d3.select("main");
var scrolly = main.select("#scrolly");
var figure = scrolly.select("#figure");
var article = scrolly.select("#article");
var step = article.selectAll(".step");

// initialize the scrollama
var scroller = scrollama();

// generic window resize listener event
function handleResize() {
  // 1. update height of step elements
  var stepH = Math.floor(window.innerHeight * 0.75);
  step.style("height", stepH + "px");

  var figureHeight = window.innerHeight / 2;
  var figureMarginTop = (window.innerHeight - figureHeight) / 2;

  figure
    .style("height", figureHeight + "px")
    .style("top", figureMarginTop + "px");

  // 3. tell scrollama to update new element dimensions
  scroller.resize();
}

// scrollama event handlers
function handleStepEnter(response) {
  console.log(response);
  // response = { element, direction, index }

  // add color to current step only
  step.classed("is-active", function (d, i) {
    return i === response.index;
  });

  // update graphic based on step
  figure.select("p").text(response.index + 1);
}

function init() {
  // 1. force a resize on load to ensure proper dimensions are sent to scrollama
  handleResize();

  // 2. setup the scroller passing options
  // 		this will also initialize trigger observations
  // 3. bind scrollama event handlers (this can be chained like below)
  scroller
    .setup({
      step: "#scrolly #article .step",
      offset: 0.33,
      debug: false,
    })
    .onStepEnter(handleStepEnter);
}

// kick things off
init();
```
