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

      this.isRangeMode = options.rangeMode || false;
      this.selectedRange = []; // Store the start and end year


      this.currentYear = this.options.initialYear;
      this.selectedYear = this.currentYear;

      this.multiSelect = options.multiSelect || false;
      this.selectedYears = [];

      this.inline = options.inline || false;
      this.createPicker();
      if (this.inline) {
        this.dropdown.style.display = "block";
      }

      this.highlightYears = options.highlightYears || [];

      this.minYear = options.minYear || Number.MIN_SAFE_INTEGER;
      this.maxYear = options.maxYear || Number.MAX_SAFE_INTEGER;

      this.theme = options.theme || {};
      this.applyTheme();

      this.updateGrid(this.currentYear - 4);
      if (this.allowQuickJump){
        this.createQuickJump();
      }
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
          if (this.highlightYears.includes(year)) {
            button.classList.add("highlight");
          }
          button.addEventListener("click", () => this.selectYear(year));
          this.yearGrid.appendChild(button);
        }
      }

    applyTheme() {
        if (this.theme.primaryColor) {
          this.container.style.setProperty("--primary-color", this.theme.primaryColor);
        }
        if (this.theme.secondaryColor) {
          this.container.style.setProperty("--secondary-color", this.theme.secondaryColor);
        }
        if (this.theme.font) {
          this.container.style.fontFamily = this.theme.font;
        }
      }

    selectYear(year) {
        if (this.isRangeMode) {
            if (this.selectedRange.length === 2) this.selectedRange = [];
            this.selectedRange.push(year);
            this.selectedRange.sort((a, b) => a - b);
            if (this.selectedRange.length === 2 && this.options.onSelect) {
              this.options.onSelect(this.selectedRange[0], this.selectedRange[1]);
            }
          } else {
            this.selectedYear = year;
            if (this.options.onSelect) this.options.onSelect(year);
          }

        if (this.multiSelect) {
          const index = this.selectedYears.indexOf(year);
          if (index !== -1) {
            this.selectedYears.splice(index, 1); // Deselect
          } else {
            this.selectedYears.push(year); // Select
          }
          if (this.options.onSelect) {
            this.options.onSelect(this.selectedYears);
          }
        } else {
          this.selectedYear = year;
          if (this.options.onSelect) {
            this.options.onSelect(year);
          }
        }
        this.updateGrid(Number(this.yearGrid.firstChild.textContent));
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

    createQuickJump() {
        const input = document.createElement("input");
        input.type = "number";
        input.placeholder = "Jump to year";
        input.className = "year-picker-quick-jump";
        input.addEventListener("change", (e) => {
          const year = parseInt(e.target.value, 10);
          if (!isNaN(year)) {
            this.updateGrid(year - 4);
          }
        });
        this.container.appendChild(input);
      }
  }

