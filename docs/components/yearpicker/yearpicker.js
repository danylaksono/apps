export class YearPicker {
    constructor(container, options = {}) {
      this.container = typeof container === "string" ? document.querySelector(container) : container;
      this.options = Object.assign(
        {
          initialYear: new Date().getFullYear(),
          onSelect: null, // Callback when a year is selected
        },
        options
      );

      this.currentYear = this.options.initialYear;
      this.selectedYear = this.currentYear;

      this.createPicker();
      this.updateGrid(this.currentYear - 4);
    }

    createPicker() {
      // Create picker structure
      this.container.innerHTML = `
        <button class="year-picker-prev" disabled>&laquo;</button>
        <div class="year-picker-display">${this.selectedYear}</div>
        <button class="year-picker-next" disabled>&raquo;</button>
        <div class="year-picker-dropdown">
          <div class="year-grid"></div>
          <button class="year-picker-today">Today</button>
        </div>
      `;

      // Attach event listeners
      this.display = this.container.querySelector(".year-picker-display");
      this.dropdown = this.container.querySelector(".year-picker-dropdown");
      this.yearGrid = this.container.querySelector(".year-grid");
      this.todayButton = this.container.querySelector(".year-picker-today");
      this.prevButton = this.container.querySelector(".year-picker-prev");
      this.nextButton = this.container.querySelector(".year-picker-next");

      this.display.addEventListener("click", () => this.toggleDropdown());
      this.prevButton.addEventListener("click", () => {
        if (!this.isDropdownVisible()) return;
        this.updateGrid(Number(this.yearGrid.firstChild.textContent) - 9);
      });
      this.nextButton.addEventListener("click", () => {
        if (!this.isDropdownVisible()) return;
        this.updateGrid(Number(this.yearGrid.firstChild.textContent) + 9);
      });
      this.todayButton.addEventListener("click", () => this.resetToToday());
    }

    updateGrid(startYear) {
      this.yearGrid.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const year = startYear + i;
        const button = document.createElement("button");
        button.textContent = year;
        button.className = year === this.selectedYear ? "selected" : "";
        button.addEventListener("click", () => this.selectYear(year));
        this.yearGrid.appendChild(button);
      }
    }

    selectYear(year) {
      this.selectedYear = year;
      this.display.textContent = this.selectedYear;
      this.updateGrid(Number(this.yearGrid.firstChild.textContent));
      this.toggleDropdown(false);

      // Trigger onSelect callback
      if (typeof this.options.onSelect === "function") {
        this.options.onSelect(this.selectedYear);
      }
    }

    resetToToday() {
      this.selectYear(new Date().getFullYear());
      this.updateGrid(this.currentYear - 4);
    }

    toggleDropdown(force) {
      const shouldShow = force !== undefined ? force : this.dropdown.style.display !== "block";
      if (shouldShow) {
        this.dropdown.style.display = "block";
        this.enableNavButtons();
      } else {
        this.dropdown.style.display = "none";
        this.disableNavButtons();
      }
    }

    isDropdownVisible() {
      return this.dropdown.style.display === "block";
    }

    enableNavButtons() {
      this.prevButton.disabled = false;
      this.nextButton.disabled = false;
    }

    disableNavButtons() {
      this.prevButton.disabled = true;
      this.nextButton.disabled = true;
    }
  }

