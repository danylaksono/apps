---
theme: dashboard
title: Test custom css
toc: false
sidebar: false
style: "./bulma.min.css"
---

<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,300italic,700,700italic">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css">

<style>
.columns {
  min-height: 100vh;
}

.columns.is-flex-grow-1 {
  flex-grow: 1;
}

.sidebar {
  background-color: #f5f5f5;
  padding: 1.5rem;
  transition: width 0.3s ease;
  max-width: 300px;
  width: 70px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.sidebar:not(.is-collapsed) {
  width: 300px;
}

.sidebar .button {
  margin-bottom: 0.5rem;
}

.sidebar .menu-label {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.sidebar .menu-list {
  margin-left: 0;
}

.sidebar .menu-list li:not(:last-child) {
  margin-bottom: 0.5rem;
}

.sidebar .menu-list a {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.3s ease;
}

.sidebar .menu-list a:hover {
  background-color: #e6e6e6;
}

.sidebar .menu-list a span {
  margin-left: 0.5rem;
}

.sidebar:not(.is-collapsed) {
  width: 300px; /* Width when expanded */
}

.sidebar:not(.is-collapsed) .is-hidden-mobile {
  display: inline-block;
}

.sidebar.is-collapsed .is-hidden-mobile {
  display: none;
}
</style>

<div class="columns ">
  <aside class="is-relative sidebar">
    <button id="toggle-sidebar" class="button is-text">
      <span class="icon">
        <i class="fas fa-bars"></i>
      </span>
    </button>
    <p class="menu-label is-hidden-mobile">General</p>
    <ul class="menu-list">
      <li><a><i class="fas fa-tachometer-alt"></i><span class="is-hidden-mobile"> Dashboard</span></a></li>
      <li><a><i class="fas fa-users"></i><span class="is-hidden-mobile"> Customers</span></a></li>
    </ul>
  </aside>
  <div class="column">
    <div class="container">
      <!-- Your content goes here -->
      <section class="section">
            <h1 class="title">Medium section</h1>
            <h2 class="subtitle">
              A simple container to divide your page into <strong>sections</strong>, like
              the one you're currently reading.
            </h2>
            <div class="columns is-multiline">
                <!-- Dashboard Card 1 -->
                <div class="column is-one-third">
                  <div class="card">
                    <div class="card-content">
                      <p class="title">Card 1</p>
                      <p class="subtitle">Card 1 Content</p>
                    </div>
                  </div>
                </div>
                <!-- Dashboard Card 2 -->
                <div class="column is-one-third">
                  <div class="card">
                    <div class="card-content">
                      <p class="title">Card 2</p>
                      <p class="subtitle">Card 2 Content</p>
                    </div>
                  </div>
                </div>
                <!-- Dashboard Card 3 -->
                <div class="column is-one-third">
                  <div class="card">
                    <div class="card-content">
                      <p class="title">Card 3</p>
                      <p class="subtitle">Card 3 Content</p>
                    </div>
                  </div>
                </div>
                <!-- Add more cards as needed -->
            </div>
          </section>
    </div>
  </div>
</div>

```js
document
  .getElementById("toggle-sidebar")
  .addEventListener("click", function () {
    var sidebar = document.querySelector(".sidebar");
    sidebar.classList.toggle("is-collapsed");
  });
```
