import * as d3 from 'npm:d3';
import _ from 'npm:lodash';

export class Histogram {
    constructor(config) {
      const defaults = {
        width: 600,
        height: 400,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        column: null,
        binThreshold: null,
        colors: ['steelblue', 'orange'],
        maxOrdinalBins: 20,
        selectionMode: 'single', // 'single', 'multiple', 'drag'
        axis: false,
        showLabelsBelow: false, // New option to show labels below the histogram
      };

      this.config = { ...defaults, ...config };
      this.data = [];
      this.selectedBins = new Set();
      this.dispatch = d3.dispatch('selectionChanged');
      this.initialized = false;
    }

    initialize(container) {
      if (!this.initialized) {
        this.container = d3.select(container);

        this.svg = this.container.append('svg')
          .attr('width', this.config.width + this.config.margin.left + this.config.margin.right)
          .attr('height', this.config.height + this.config.margin.top + this.config.margin.bottom)
          .append('g')
          .attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

        // Tooltip for hover
        this.tooltip = d3.select('body').append('div')
          .attr('class', 'histogram-tooltip')
          .style('opacity', 0)
          .style('position', 'absolute')
          .style('background', 'white')
          .style('padding', '5px')
          .style('border', '1px solid #ccc');

        // Labels below the histogram
        if (this.config.showLabelsBelow) {
          this.labelGroup = this.svg.append('g')
            .attr('class', 'labels')
            .attr('transform', `translate(0,${this.config.height + 10})`);
        }

        // Brush for drag selection
        this.brush = d3.brushX()
          .extent([[0, 0], [this.config.width, this.config.height]])
          .on('end', this.handleBrush.bind(this));

        // Click outside bins to clear selection
        this.svg.on('click', (event) => {
          if (!event.target.classList.contains('bar')) {
            this.clearSelection();
          }
        });

        this.initialized = true;
      }
      return this;
    }

    update(data) {
      if (!this.initialized) throw new Error('Histogram not initialized');
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
        if (typeof value === 'number') return 'continuous';
        if (value instanceof Date) return 'date';
        return 'ordinal';
      }
      return 'ordinal';
    }

    binData(data, column, type) {
      const accessor = d => d[column];
      let bins;

      switch (type) {
        case 'continuous':
          const threshold = this.config.binThreshold || d3.thresholdFreedmanDiaconis;
          const histogram = d3.histogram()
            .value(accessor)
            .thresholds(threshold);
          bins = histogram(data);
          break;

        case 'date':
          const timeHistogram = d3.histogram()
            .value(d => accessor(d).getTime())
            .thresholds(d3.timeMillisecond.every(86400000)); // Daily bins by default
          bins = timeHistogram(data);
          break;

        case 'ordinal':
          const grouped = _.groupBy(data, accessor);
          bins = Object.entries(grouped).map(([key, values]) => ({
            key,
            length: values.length,
            x0: key,
            x1: key
          }));
          if (bins.length > this.config.maxOrdinalBins) {
            bins = this.handleLargeOrdinalBins(bins);
          }
          break;
      }

      return bins;
    }

    createXScale() {
      const { type, bins, config: { width } } = this;

      if (type === 'ordinal') {
        return d3.scaleBand()
          .domain(bins.map(b => b.key))
          .range([0, width])
          .padding(0.1);
      }

      const extent = d3.extent(bins.flatMap(b => [b.x0, b.x1]));
      return type === 'date'
        ? d3.scaleTime().domain(extent).range([0, width])
        : d3.scaleLinear().domain(extent).range([0, width]);
    }

    createYScale() {
      const max = d3.max(this.bins, b => b.length);
      return d3.scaleLinear()
        .domain([0, max])
        .nice()
        .range([this.config.height, 0]);
    }

    draw() {
      this.drawBars();
      if (this.config.axis) this.drawAxes();
      if (this.config.selectionMode === 'drag') this.svg.call(this.brush);
    }

    drawBars() {
      const { xScale, yScale, config: { height }, bins } = this;
      const bars = this.svg.selectAll('.bar')
        .data(bins, b => b.x0);

      bars.exit().remove();

      const enter = bars.enter().append('rect')
        .attr('class', 'bar')
        .attr('stroke', 'white')     // Add white stroke
        .attr('stroke-width', '1')   // Set stroke width to 1px
        .on('mouseover', (event, d) => this.handleMouseOver(event, d))
        .on('mouseout', (event, d) => this.handleMouseOut(event, d))
        .on('click', (event, d) => this.handleClick(event, d));

      bars.merge(enter)
        .attr('x', b => xScale(b.x0))
        .attr('y', b => yScale(b.length))
        .attr('width', b => this.getBarWidth(b))
        .attr('height', b => height - yScale(b.length))
        .attr('fill', b => this.selectedBins.has(b) ? this.config.colors[1] : this.config.colors[0]);
    }

    getBarWidth(b) {
      return this.config.type === 'ordinal'
        ? this.xScale.bandwidth()
        : Math.max(1, this.xScale(b.x1) - this.xScale(b.x0));
    }

    handleMouseOver(event, d) {
      const category = d.key; // Define category
      this.tooltip
        .style('opacity', 1)
        .html(`Category: ${category}<br>Count: ${d.length}`)
        .style('left', `${event.pageX}px`)
        .style('top', `${event.pageY + 10}px`);

      d3.select(event.currentTarget).attr('fill', this.config.colors[1]);

      // Show label instead of tooltip
      if (this.config.showLabelsBelow) {
        this.labelGroup.selectAll('.label').remove();
        this.labelGroup.append('text')
          .attr('class', 'label')
          .attr('x', this.xScale(d.x0) + this.getBarWidth(d) / 2)
          .attr('y', this.config.height + 10)
          .attr('text-anchor', 'middle')
          .text(`${category}: ${d.length}`);
      }
    }

    handleMouseOut(event) {
      this.tooltip.style('opacity', 0);
      this.labelGroup.selectAll('.label').remove();
      const bin = this.bins.find(b => b.x0 === event.currentTarget.__data__.x0);
      d3.select(event.currentTarget)
        .attr('fill', this.selectedBins.has(bin) ? this.config.colors[1] : this.config.colors[0]);
    }

    handleClick(event, d) {
      if (event.ctrlKey && this.config.selectionMode === 'multiple') {
        // Toggle selection only in multiple mode with CTRL pressed
        this.selectedBins.has(d) ? this.selectedBins.delete(d) : this.selectedBins.add(d);
      } else {
        // Single selection mode - clear previous and select new
        this.selectedBins.clear();
        this.selectedBins.add(d);
      }
      this.dispatch.call('selectionChanged', this, this.getSelectedData());
      this.drawBars();
    }

    handleBrush(event) {
      if (!event.selection) return;
      const [x0, x1] = event.selection;
      const selected = this.bins.filter(b =>
        this.xScale(b.x0) <= x1 && this.xScale(b.x1) >= x0
      );
      this.selectedBins = new Set(selected);
      this.dispatch.call('selectionChanged', this, this.getSelectedData());
      this.drawBars();
    }

    getSelectedData() {
      return Array.from(this.selectedBins).flatMap(bin => bin);
    }

    clearSelection() {
      this.selectedBins.clear();
      this.drawBars();
      this.dispatch.call('selectionChanged', this, []);
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
      const sorted = _.orderBy(bins, ['length'], ['desc']);
      const topBins = sorted.slice(0, this.config.maxOrdinalBins - 1);
      const others = sorted.slice(this.config.maxOrdinalBins - 1);
      const otherBin = {
        key: 'Other',
        length: _.sumBy(others, 'length'),
        x0: 'Other',
        x1: 'Other'
      };
      return [...topBins, otherBin];
    }
  }
