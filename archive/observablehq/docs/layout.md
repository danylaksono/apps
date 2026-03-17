---
title: Testing layout
toc: false
sidebar: false
footer: false
style: ./style/basic.css
---

<!-------- Stylesheets -------->
<!-- <link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"> -->

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

#observablehq-center {
  margin: 0.5rem !important;
}

.grid {
  margin: 0 !important;
}


.grid-container {
    display: grid;
    grid-template-columns: 1fr 4fr;
    grid-template-rows: repeat(2, 1fr) 1fr;
    gap: 8px; /* gap between grid items */
    padding: 8px;
    height: 92vh;
  }

  /* Left panel boxes */
  #left-panel {
     /* Spans 2 rows */
    display: grid;
    grid-template-rows: 1fr 1fr; /* Two equal rows */
    gap: 8px;
  }


  /* Right panel boxes */
  #main-panel {
    /*grid-row: span 2;  Spans 2 rows */
    display: grid;
    grid-template-rows: 3fr 2fr;
    height: 92vh;
    gap: 8px;
  }

  /* Main panel bottom, split into two sections */
  .main-bottom {
    /* grid-row: 2 / 3; Takes the second row */
    display: grid;
    grid-template-columns: 3fr 1fr; /* Split bottom row into 3/1 ratio */
    gap: 8px;
  }

    .card {
      display: flex; /* Use Flexbox */
      justify-content: center; /* Horizontally center content */
      align-items: center; /* Vertically center content */
      text-align: center; /* Center text alignment for multiline */
      border: 0.5px;
      padding: 8px;
      box-sizing: border-box; /* Ensure padding is included in height calculations */
    }

  .main-top,
  .main-bottom .card {
      height: 100%; /* Let the grid layout define height naturally */
  }

</style>

 <div class="grid-container" style="padding:8px; height:92vh;">
    <!-- Left panel (two boxes, stacked vertically) -->
    <div id="left-panel">
      <div class="card" >Project properties</div>
      <div class="card" >Interventions</div>
    </div>
    <!-- Main panel (right side) -->
    <div id="main-panel">
      <div class="card main-top">Map View</div>
      <div class="main-bottom">
        <div class="card">Sortable Table</div>
        <div class="card">Details on demand</div>
      </div>
    </div>
  </div>
