---
title: Testing layout
toc: false
sidebar: false
footer: false
---

<!-------- Stylesheets -------->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css">
<link rel="stylesheet" href="./styles/bulma-quickview.min.css">

<!---------- NPM Imports ------------>

```js
import * as bulmaToast from "npm:bulma-toast";
import * as bulmaQuickview from "npm:bulma-quickview@2.0.0/dist/js/bulma-quickview.js";
```

<style>
    body, html {
  height: 100%;
  margin: 0 !important;
  overflow: hidden;
  padding: 0;
}

#observablehq-main, #observablehq-header, #observablehq-footer {
    margin: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
}

#observablehq-center {
  margin: 0.5rem !important;
}

</style>

<script src="bulma-toast.min.js"></script>

```js
// bulmaToast.toast({ message: "General Kenobi", type: "is-danger" });
```

<!-- Main Body -->

<nav class="navbar" role="navigation" aria-label="main navigation">
  <div class="navbar-brand">
    <a class="navbar-item" href="https://bulma.io">
</svg>
    </a>
    <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false" data-target="navbarBasicExample">
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
    </a>
  </div>
  <div id="navbarBasicExample" class="navbar-menu">
    <div class="navbar-start">
      <a class="navbar-item">
        Home
      </a>
      <a class="navbar-item">
        Documentation
      </a>
      <div class="navbar-item has-dropdown is-hoverable">
        <a class="navbar-link">
          More
        </a>
        <div class="navbar-dropdown">
          <a class="navbar-item">
            About
          </a>
          <a class="navbar-item is-selected">
            Jobs
          </a>
          <a class="navbar-item">
            Contact
          </a>
          <hr class="navbar-divider">
          <a class="navbar-item">
            Report an issue
          </a>
        </div>
      </div>
    </div>
    <div class="navbar-end">
      <div class="navbar-item">
        <div class="buttons">
          <a class="button is-primary">
            <strong>Sign up</strong>
          </a>
          <a class="button is-light">
            Log in
          </a>
        </div>
      </div>
    </div>
  </div>
</nav>

<div class="dropdown">
  <div class="dropdown-trigger">
    <button class="button" aria-haspopup="true" aria-controls="dropdown-menu">
      <span>Dropdown button</span>
      <span class="icon is-small">
        <i class="fas fa-angle-down" aria-hidden="true"></i>
      </span>
    </button>
  </div>
  <div class="dropdown-menu" id="dropdown-menu" role="menu">
    <div class="dropdown-content">
      <a href="#" class="dropdown-item"> Dropdown item </a>
      <a class="dropdown-item"> Other dropdown item </a>
      <a href="#" class="dropdown-item is-active"> Active dropdown item </a>
      <a href="#" class="dropdown-item"> Other dropdown item </a>
      <hr class="dropdown-divider" />
      <a href="#" class="dropdown-item"> With a divider </a>
    </div>
  </div>
</div>

<button class="button is-primary" data-show="quickview" data-target="quickviewDefault"> Show quickview </button>

<div id="quickviewDefault" class="quickview is-left">
  <header class="quickview-header">
    <p class="title">Quickview title</p>
    <span class="delete" data-dismiss="quickview"></span>
  </header>
  <div class="quickview-body">
    <div class="quickview-block">content here</div>
  </div>
  <footer class="quickview-footer"></footer>
</div>

```js
// Quickview functionality
const quickviewButton = document.querySelector('[data-show="quickview"]');
const quickview = document.getElementById(quickviewButton.dataset.target);
const dismissButtons = document.querySelectorAll('[data-dismiss="quickview"]');

quickviewButton.addEventListener("click", () => {
  quickview.classList.add("is-active");
});

dismissButtons.forEach((button) => {
  button.addEventListener("click", () => {
    quickview.classList.remove("is-active");
  });
});
```

```js
// DROPDOWNS
const $clickableDropdowns = document.querySelectorAll(
  ".dropdown:not(.is-hoverable)"
);

if ($clickableDropdowns.length > 0) {
  $clickableDropdowns.forEach(($dropdown) => {
    if (!$dropdown.querySelector("button")) {
      return;
    }

    $dropdown.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      $dropdown.classList.toggle("is-active");
    });
  });

  document.addEventListener("click", () => {
    closeDropdowns();
  });
}

function closeDropdowns() {
  $clickableDropdowns.forEach(($el) => {
    $el.classList.remove("is-active");
  });
}
```

```js
// MODALS
// Functions to open and close a modal
function openModal($el) {
  if (!$el) {
    return;
  }

  $el.classList.add("is-active");
}

function closeModal($el) {
  if (!$el) {
    return;
  }

  $el.classList.remove("is-active");
}

function closeAllModals() {
  (document.querySelectorAll(".modal") || []).forEach(($modal) => {
    closeModal($modal);
  });
}

(document.querySelectorAll(".js-modal-trigger") || []).forEach(($trigger) => {
  const modal = $trigger.dataset.target;
  const $target = document.getElementById(modal);

  $trigger.addEventListener("click", () => {
    openModal($target);
  });
});

(
  document.querySelectorAll(
    ".modal-background, .modal-close, .modal-card-head .delete, .modal-card-foot .button"
  ) || []
).forEach(($close) => {
  const $target = $close.closest(".modal");

  $close.addEventListener("click", () => {
    closeModal($target);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});
```
