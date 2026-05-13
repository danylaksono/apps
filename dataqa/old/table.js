import {
  createTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
} from 'https://cdn.jsdelivr.net/npm/@tanstack/table-core@8.13.2/+esm';

export class AttributeTable {
  constructor(containerId, toolbarId, paginationId) {
    this.container = document.getElementById(containerId);
    this.toolbarContainer = document.getElementById(toolbarId);
    this.paginationContainer = document.getElementById(paginationId);
    this.table = null;
    this.data = [];
    this.allColumns = [];
    this.visibleColumns = new Set();
    this.onRowHover = null;
    this._tableState = null;
    this._columnDropdownOpen = false;
    this._filterColumn = '';
    this._filterValue = '';
  }

  render(data, columns, onRowHover) {
    this.data = data;
    this.onRowHover = onRowHover;
    this.allColumns = columns || [];
    this.visibleColumns = new Set(this.allColumns);
    this._filterColumn = '';
    this._filterValue = '';

    if (!columns || columns.length === 0) {
      this.container.innerHTML = '<div style="padding:1rem;color:var(--muted)">No columns to display.</div>';
      if (this.toolbarContainer) this.toolbarContainer.innerHTML = '';
      if (this.paginationContainer) this.paginationContainer.innerHTML = '';
      return;
    }

    this._buildTable();
    this._drawToolbar();
    this.draw();
  }

  _buildTable() {
    const cols = [...this.visibleColumns].map(c => ({
      id: String(c),
      accessorKey: String(c),
      header: String(c),
    }));

    const baseOptions = {
      data: this._getFilteredData(),
      columns: cols,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      initialState: {
        pagination: { pageIndex: 0, pageSize: 100 },
        sorting: [],
      },
    };

    this.table = createTable(baseOptions);
    this._tableState = { ...this.table.initialState };

    this.table.setOptions(prev => ({
      ...prev,
      state: this._tableState,
      onStateChange: (updater) => {
        this._tableState =
          typeof updater === 'function'
            ? updater(this._tableState)
            : updater;
        this.table.setOptions(p => ({ ...p, state: this._tableState }));
        this.draw();
      },
    }));
  }

  _getFilteredData() {
    if (!this._filterColumn || !this._filterValue) return this.data;
    const col = this._filterColumn;
    const val = this._filterValue.toLowerCase();
    return this.data.filter(row => {
      const cell = row[col];
      if (cell === null || cell === undefined) return false;
      return String(cell).toLowerCase().includes(val);
    });
  }

  _drawToolbar() {
    if (!this.toolbarContainer) return;

    this.toolbarContainer.innerHTML = `
      <div class="table-toolbar">
        <div class="toolbar-left">
          <div class="toolbar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="table-global-search" class="toolbar-input" placeholder="Search all columns…" />
          </div>
          <div class="toolbar-filter">
            <select id="table-filter-col" class="toolbar-select">
              <option value="">Filter column…</option>
              ${this.allColumns.map(c => `<option value="${this.escape(c)}">${this.escape(c)}</option>`).join('')}
            </select>
            <input type="text" id="table-filter-val" class="toolbar-input toolbar-filter-val" placeholder="Contains…" disabled />
          </div>
        </div>
        <div class="toolbar-right">
          <div class="column-picker-wrap">
            <button class="btn-toolbar" id="col-picker-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Columns <span class="col-count">${this.visibleColumns.size}/${this.allColumns.length}</span>
            </button>
            <div class="column-picker-dropdown" id="col-picker-dropdown">
              <div class="col-picker-actions">
                <button class="col-picker-action" data-action="all">Show all</button>
                <button class="col-picker-action" data-action="none">Hide all</button>
              </div>
              <div class="col-picker-list">
                ${this.allColumns.map(c => `
                  <label class="col-picker-item">
                    <input type="checkbox" value="${this.escape(c)}" ${this.visibleColumns.has(c) ? 'checked' : ''} />
                    <span>${this.escape(c)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          <span class="toolbar-count">${this._getFilteredData().length.toLocaleString()} rows</span>
        </div>
      </div>
    `;

    // Search handler
    const searchInput = document.getElementById('table-global-search');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      if (q) {
        // Global search across all visible columns
        this._filterColumn = '';
        this._filterValue = '';
        const filtered = this.data.filter(row =>
          [...this.visibleColumns].some(col => {
            const v = row[col];
            if (v === null || v === undefined) return false;
            return String(v).toLowerCase().includes(q);
          })
        );
        this._rebuildWithData(filtered);
      } else {
        this._rebuildWithData(this.data);
      }
    });

    // Column filter handler
    const filterCol = document.getElementById('table-filter-col');
    const filterVal = document.getElementById('table-filter-val');

    filterCol.addEventListener('change', () => {
      this._filterColumn = filterCol.value;
      filterVal.disabled = !filterCol.value;
      if (!filterCol.value) {
        this._filterValue = '';
        filterVal.value = '';
        this._rebuildFromFilter();
      }
    });

    filterVal.addEventListener('input', () => {
      this._filterValue = filterVal.value;
      // Clear global search when using column filter
      searchInput.value = '';
      this._rebuildFromFilter();
    });

    // Column picker toggle
    const pickerBtn = document.getElementById('col-picker-btn');
    const pickerDropdown = document.getElementById('col-picker-dropdown');

    pickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._columnDropdownOpen = !this._columnDropdownOpen;
      pickerDropdown.classList.toggle('open', this._columnDropdownOpen);
    });

    // Close picker on outside click
    document.addEventListener('click', () => {
      if (this._columnDropdownOpen) {
        this._columnDropdownOpen = false;
        pickerDropdown.classList.remove('open');
      }
    });

    pickerDropdown.addEventListener('click', (e) => e.stopPropagation());

    // Column checkboxes
    pickerDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          this.visibleColumns.add(cb.value);
        } else {
          this.visibleColumns.delete(cb.value);
        }
        this._updateColumnCount();
        this._buildTable();
        this.draw();
      });
    });

    // Show all / Hide all
    pickerDropdown.querySelectorAll('.col-picker-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'all') {
          this.visibleColumns = new Set(this.allColumns);
        } else {
          this.visibleColumns.clear();
        }
        pickerDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = action === 'all';
        });
        this._updateColumnCount();
        this._buildTable();
        this.draw();
      });
    });
  }

  _updateColumnCount() {
    const el = this.toolbarContainer.querySelector('.col-count');
    if (el) el.textContent = `${this.visibleColumns.size}/${this.allColumns.length}`;
  }

  _rebuildFromFilter() {
    this._rebuildWithData(this._getFilteredData());
  }

  _rebuildWithData(data) {
    const cols = [...this.visibleColumns].map(c => ({
      id: String(c),
      accessorKey: String(c),
      header: String(c),
    }));

    this.table.setOptions(prev => ({
      ...prev,
      data,
      columns: cols,
      state: { ...this._tableState, pagination: { ...this._tableState.pagination, pageIndex: 0 } },
    }));
    this._tableState = { ...this._tableState, pagination: { ...this._tableState.pagination, pageIndex: 0 } };

    // Update row count
    const countEl = this.toolbarContainer.querySelector('.toolbar-count');
    if (countEl) countEl.textContent = `${data.length.toLocaleString()} rows`;

    this.draw();
  }

  draw() {
    if (!this.table) return;

    let headerGroups;
    try {
      headerGroups = this.table.getHeaderGroups();
    } catch (e) {
      console.warn('Table draw error:', e.message);
      this.container.innerHTML = `<div style="padding:1rem;color:var(--red)">Table render failed: ${e.message}</div>`;
      return;
    }

    const rows = this.table.getRowModel().rows;

    let html = `<table class="tanstack-table"><thead>`;
    headerGroups.forEach(hg => {
      html += `<tr>`;
      hg.headers.forEach(h => {
        const colId = h.column.id;
        const sortDir = h.column.getIsSorted();
        const arrow = sortDir === 'asc' ? ' ↑' : sortDir === 'desc' ? ' ↓' : '';
        html += `<th class="sortable-th" data-col-id="${this.escape(colId)}">${this.escape(String(h.column.columnDef.header))}${arrow}</th>`;
      });
      html += `</tr>`;
    });
    html += `</thead><tbody>`;

    if (rows.length === 0) {
      const colspan = this.visibleColumns.size || 1;
      html += `<tr><td colspan="${colspan}" style="text-align:center;padding:24px;color:var(--muted)">No matching rows</td></tr>`;
    }

    rows.forEach(r => {
      html += `<tr data-idx="${r.index}" class="table-row">`;
      r.getVisibleCells().forEach(c => {
        let val = c.getValue();
        if (val === null || val === undefined) val = '';
        else if (typeof val === 'object') val = JSON.stringify(val);
        html += `<td>${this.escape(String(val))}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    this.container.innerHTML = html;

    // Sorting click
    this.container.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const colId = th.dataset.colId;
        const currentSort = this._tableState.sorting || [];
        const existing = currentSort.find(s => s.id === colId);
        let newSorting;
        if (!existing) {
          newSorting = [{ id: colId, desc: false }];
        } else if (!existing.desc) {
          newSorting = [{ id: colId, desc: true }];
        } else {
          newSorting = [];
        }
        this._tableState = { ...this._tableState, sorting: newSorting };
        this.table.setOptions(p => ({ ...p, state: this._tableState }));
        this.draw();
      });
    });

    // Row hover events
    if (this.onRowHover) {
      this.container.querySelectorAll('.table-row').forEach(row => {
        row.addEventListener('mouseenter', e => {
          const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
          // Get the actual data row from the table's row model
          const tableRow = this.table.getRowModel().rows.find(r => r.index === idx);
          if (tableRow) {
            this.onRowHover(tableRow.original);
          }
        });
        row.addEventListener('mouseleave', () => this.onRowHover(null));
      });
    }

    this.drawPagination();
  }

  drawPagination() {
    if (!this.paginationContainer) return;
    const pagination = this._tableState.pagination;
    const pageCount  = this.table.getPageCount();
    const canPrev    = this.table.getCanPreviousPage();
    const canNext    = this.table.getCanNextPage();

    this.paginationContainer.innerHTML = `
      <span>
        Page ${pagination.pageIndex + 1} of ${pageCount || 1}
      </span>
      <div class="page-btns">
        <button data-page="first" ${canPrev ? '' : 'disabled'}>«</button>
        <button data-page="prev"  ${canPrev ? '' : 'disabled'}>‹</button>
        <button data-page="next"  ${canNext ? '' : 'disabled'}>›</button>
        <button data-page="last"  ${canNext ? '' : 'disabled'}>»</button>
      </div>
    `;

    this.paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.page;
        if (action === 'first') this.table.setPageIndex(0);
        if (action === 'prev')  this.table.previousPage();
        if (action === 'next')  this.table.nextPage();
        if (action === 'last')  this.table.setPageIndex(pageCount - 1);
        this._tableState = this.table.getState();
        this.draw();
      });
    });
  }

  highlightRow(dataItem) {
    this.container.querySelectorAll('.table-row.selected').forEach(el => el.classList.remove('selected'));
    if (!dataItem) return;
    const idx = this.data.indexOf(dataItem);
    if (idx !== -1) {
      const rowEl = this.container.querySelector(`.table-row[data-idx="${idx}"]`);
      if (rowEl) {
        rowEl.classList.add('selected');
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
