import * as d3 from "npm:d3";
import _ from "npm:lodash";

export class Histogram {
  constructor(config) {
    const defaults = {
      width: 600,
      height: 400,
      margin: { top: 20, right: 20, bottom: 40, left: 40 },
      column: null,
      binThreshold: null,
      colors: ["steelblue", "orange"],
      maxOrdinalBins: 20,
      selectionMode: "single", // 'single', 'multiple', 'drag'
      axis: false,
      showLabelsBelow: false, // New option to show labels below the histogram
    };

    this.config = { ...defaults, ...config };
    this.data = [];
    this.selectedBins = new Set();
    this.dispatch = d3.dispatch("selectionChanged");
    this.initialized = false;

    // Automatically initialize the histogram
    this.createSvg();
  }

  createSvg() {
    const { width, height, margin } = this.config;

    // Create the SVG container using d3.create
    this.svg = d3
      .create("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", [
        0,
        0,
        width + margin.left + margin.right,
        height + margin.top + margin.bottom,
      ])
      .attr("style", "max-width: 100%; height: auto;");

    // Create a group element for the histogram
    this.g = this.svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Tooltip for hover
    this.tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "histogram-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "white")
      .style("padding", "5px")
      .style("border", "1px solid #ccc");

    // Labels below the histogram
    if (this.config.showLabelsBelow) {
      const centerX = this.config.width / 2;
      this.labelGroup = this.g
        .append("g")
        .attr("class", "labels")
        .attr("transform", `translate(${centerX},${this.config.height + 25})`);
    }

    // Brush for drag selection
    this.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [this.config.width, this.config.height],
      ])
      .on("end", this.handleBrush.bind(this));

    // Click outside bins to clear selection
    this.g.on("click", (event) => {
      if (!event.target.classList.contains("bar")) {
        this.clearSelection();
      }
    });

    this.initialized = true;
    return this.svg.node(); // Return the SVG node
  }

  update(data) {
    if (!this.initialized) {
      // Automatically initialize if not already initialized
      this.createSvg();
    }
    this.data = data;
    this.processData();
    this.draw();
    return this;
  }

  processData() {
    const { column } = this.config;
    this.type = this.getType(this.data, column);
    this.bins = this.binData(this.data, column, this.type);

    this.xScale = this.createXScale();
    this.yScale = this.createYScale();
  }

  getType(data, column) {
    for (const d of data) {
      const value = d[column];
      if (value === undefined) continue;
      if (value == null) continue;
      if (typeof value === "number") return "continuous";
      if (value instanceof Date) return "date";
      return "ordinal";
    }
    return "ordinal";
  }

  binData(data, column, type) {
    const accessor = (d) => d[column];
    let bins;

    switch (type) {
      case "continuous":
        const threshold =
          this.config.binThreshold || d3.thresholdFreedmanDiaconis;
        const histogram = d3.histogram().value(accessor).thresholds(threshold);
        bins = histogram(data);
        break;

      case "date":
        const timeHistogram = d3
          .histogram()
          .value((d) => accessor(d).getTime())
          .thresholds(d3.timeMillisecond.every(86400000)); // Daily bins by default
        bins = timeHistogram(data);
        break;

      case "ordinal":
        const grouped = _.groupBy(data, accessor);
        bins = Object.entries(grouped).map(([key, values]) => ({
          key,
          length: values.length,
          x0: key,
          x1: key,
        }));
        if (bins.length > this.config.maxOrdinalBins) {
          bins = this.handleLargeOrdinalBins(bins);
        }
        break;
    }

    return bins;
  }

  createXScale() {
    const {
      type,
      bins,
      config: { width },
    } = this;

    if (type === "ordinal") {
      return d3
        .scaleBand()
        .domain(bins.map((b) => b.key))
        .range([0, width])
        .padding(0.1);
    }

    const extent = d3.extent(bins.flatMap((b) => [b.x0, b.x1]));
    return type === "date"
      ? d3.scaleTime().domain(extent).range([0, width])
      : d3.scaleLinear().domain(extent).range([0, width]);
  }

  createYScale() {
    const max = d3.max(this.bins, (b) => b.length);
    return d3
      .scaleLinear()
      .domain([0, max])
      .nice()
      .range([this.config.height, 0]);
  }

  draw() {
    this.drawBars(); // Draw bars first
    if (this.config.axis) this.drawAxes(); // Draw axes if enabled
    if (this.config.showLabelsBelow) this.drawLabels(); // Draw labels if enabled

    // Draw brush overlay on top of bars
    if (this.config.selectionMode === "drag") {
      this.g
        .append("g") // Append brush group after bars
        .attr("class", "brush")
        .call(this.brush);
    }
  }

  drawBars() {
    const {
      xScale,
      yScale,
      config: { height },
      bins,
    } = this;
    const bars = this.g.selectAll(".bar").data(bins, (b) => b.x0);

    bars.exit().remove();

    const enter = bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("stroke", "white") // Add white stroke
      .attr("stroke-width", "1") // Set stroke width to 1px
      .on("mouseover", (event, d) => this.handleMouseOver(event, d))
      .on("mouseout", (event, d) => this.handleMouseOut(event, d))
      .on("click", (event, d) => this.handleClick(event, d));

    bars
      .merge(enter)
      .attr("x", (b) => xScale(b.x0))
      .attr("y", (b) => yScale(b.length))
      .attr("width", (b) => this.getBarWidth(b))
      .attr("height", (b) => height - yScale(b.length))
      .attr("fill", (b) =>
        this.selectedBins.has(b) ? this.config.colors[1] : this.config.colors[0]
      );
  }

  drawLabels() {
    const { xScale, bins } = this;

    // Clear existing labels
    this.labelGroup.selectAll(".label").remove();

    // Add new labels
    this.labelGroup
      .selectAll(".label")
      .data(bins)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .attr("font-size", "12px")
      .attr(
        "x",
        (b) =>
          xScale(b.x0) +
          (this.config.type === "ordinal"
            ? xScale.bandwidth() / 2
            : (xScale(b.x1) - xScale(b.x0)) / 2)
      )
      .text((b) => `${b.key}: ${b.length}`);
  }

  getBarWidth(b) {
    if (this.type === "ordinal") {
      // Use scaleBand bandwidth for ordinal data
      return this.xScale.bandwidth();
    }

    // For continuous/date data, calculate width from scales
    const width = Math.max(1, this.xScale(b.x1) - this.xScale(b.x0));
    return isNaN(width) ? 0 : width;
  }

  handleMouseOver(event, d) {
    if (this.config.showLabelsBelow) {
      // Hide tooltip when showing labels
      this.tooltip.style("opacity", 0);

      // Clear previous labels
      this.labelGroup.selectAll(".label").remove();

      // Add new label
      this.labelGroup
        .append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .attr("font-size", "12px")
        .text(`${d.key || d.x0}: ${d.length}`);
    } else {
      // Show tooltip if labels are disabled
      this.tooltip
        .style("opacity", 1)
        .html(`Category: ${d.key || d.x0}<br>Count: ${d.length}`)
        .style("left", `${event.pageX}px`)
        .style("top", `${event.pageY + 10}px`);
    }

    d3.select(event.currentTarget).attr("fill", this.config.colors[1]);
  }

  handleMouseOut(event) {
    // Clear both tooltip and labels
    this.tooltip.style("opacity", 0);
    if (this.config.showLabelsBelow) {
      this.labelGroup.selectAll(".label").remove();
    }

    const bin = this.bins.find((b) => b.x0 === event.currentTarget.__data__.x0);
    d3.select(event.currentTarget).attr(
      "fill",
      this.selectedBins.has(bin) ? this.config.colors[1] : this.config.colors[0]
    );
  }

  handleClick(event, d) {
    const isSelected = this.selectedBins.has(d);

    if (event.ctrlKey && this.config.selectionMode === "multiple") {
      // Toggle selection in multiple mode with CTRL
      this.selectedBins.has(d)
        ? this.selectedBins.delete(d)
        : this.selectedBins.add(d);
    } else {
      // Single selection mode
      if (isSelected) {
        // Deselect if already selected
        this.selectedBins.clear();
      } else {
        // Select new bar
        this.selectedBins.clear();
        this.selectedBins.add(d);
      }
    }

    this.dispatch.call("selectionChanged", this, this.getSelectedData());
    this.drawBars();
  }

  handleBrush(event) {
    if (!event.selection) {
      // Clear selection if brush was cleared
      this.clearSelection();
      return;
    }

    const [x0, x1] = event.selection;

    // Find bins within brush selection
    const selected = this.bins.filter((b) => {
      const binLeft = this.xScale(b.x0);
      const binRight = this.xScale(b.x1);
      return binLeft <= x1 && binRight >= x0;
    });

    // Update selection
    this.selectedBins = new Set(selected);

    // Redraw with new selection
    this.drawBars();

    // Dispatch selection event
    this.dispatch.call("selectionChanged", this, this.getSelectedData());
  }

  getSelectedData() {
    if (this.selectedBins.size === 0) return [];

    // Get all original data points from selected bins
    return Array.from(this.selectedBins).flatMap((bin) => {
      if (this.type === "ordinal") {
        // For ordinal data, find matching key
        return this.data.filter((d) => d[this.config.column] === bin.key);
      } else if (this.type === "date") {
        // For date data, check if point falls within bin range
        return this.data.filter((d) => {
          const value = d[this.config.column].getTime();
          return value >= bin.x0 && value <= bin.x1;
        });
      } else {
        // For continuous numeric data
        return this.data.filter((d) => {
          const value = d[this.config.column];
          return value >= bin.x0 && value < bin.x1;
        });
      }
    });
  }

  clearSelection() {
    this.selectedBins.clear();
    this.drawBars();
    this.dispatch.call("selectionChanged", this, []);
  }

  reset() {
    this.selectedBins.clear();
    this.processData();
    this.draw();
  }

  on(event, callback) {
    this.dispatch.on(event, callback);
    return this;
  }

  destroy() {
    this.svg.remove();
    this.tooltip.remove();
    this.initialized = false;
  }

  // Utility methods
  handleLargeOrdinalBins(bins) {
    const sorted = _.orderBy(bins, ["length"], ["desc"]);
    const topBins = sorted.slice(0, this.config.maxOrdinalBins - 1);
    const others = sorted.slice(this.config.maxOrdinalBins - 1);
    const otherBin = {
      key: "Other",
      length: _.sumBy(others, "length"),
      x0: "Other",
      x1: "Other",
    };
    return [...topBins, otherBin];
  }

  drawAxes() {
    // Remove existing axes
    this.g.selectAll(".axis").remove();

    // Create X axis
    const xAxis = d3.axisBottom(this.xScale).tickFormat((d) => {
      if (this.type === "date") {
        return d3.timeFormat("%Y-%m-%d")(d);
      }
      return d;
    });

    this.g
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${this.config.height})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-45)");

    // Create Y axis
    const yAxis = d3.axisLeft(this.yScale).ticks(5);

    this.g.append("g").attr("class", "axis y-axis").call(yAxis);
  }
}
