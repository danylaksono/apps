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
  display: flex;
  height: 100vh; /* Set the height of the parent container */
  overflow: hidden; /* Prevent content overflow */
}

.columns.is-flex-grow-1 {
  flex-grow: 1; /* Allow the child elements to grow and fill the parent container */
}

.menu {
  position: sticky;
  max-height: 100vh;
  overflow-y: auto;
  width: 300px;
  top: 0;
  bottom: 0;
  padding: 30px;
  transition: width 0.3s ease; /* Add a transition for smooth animation */
}

.menu.is-collapsed {
  width: 70px;
  padding: 10px;
}

.content {
  flex-grow: 1; /* Allow the content area to grow and fill the remaining space */
  display: flex; /* Add display flex to the content area */
  flex-direction: column; /* Stack the content and footer vertically */
}

.is-hidden {
  display: none;
}
</style>

<div class="is-widescreen">
    <div class="columns  is-flex-grow-1">
      <aside class="menu">
        <button id="toggle-sidebar" class="button">
          <span class="icon">
            <i class="fas fa-bars"></i>
          </span>
        </button>
        <p class="menu-label is-hidden">General</p>
        <ul class="menu-list">
          <li><a><i class="fas fa-tachometer-alt"></i><span class="is-hidden"> Dashboard</span></a></li>
          <li><a><i class="fas fa-users"></i><span class="is-hidden"> Customers</span></a></li>
        </ul>
        <!-- Add more menu items as needed -->
      </aside>
    </div>
    <div class="column content">
      <div class="container notification is-primary">
          <h1>test</h1>
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
          <!-- Add your content here -->
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
      <footer class="footer">
        <div class="content has-text-centered">
          <p>
            <strong>Bulma</strong> by <a href="https://jgthms.com">Jeremy Thomas</a>.
            The source code is licensed
            <a href="http://opensource.org/licenses/mit-license.php">MIT</a>. The
            website content is licensed
            <a href="http://creativecommons.org/licenses/by-nc-sa/4.0/"
              >CC BY NC SA 4.0</a
            >.
          </p>
        </div>
      </footer>
  </div>
</div>

```js
document
  .getElementById("toggle-sidebar")
  .addEventListener("click", function () {
    var menuLabels = document.querySelectorAll(".menu-label");
    var menuListSpans = document.querySelectorAll(".menu-list span");
    var mainContent = document.querySelector(".column.content");
    var sidebarMenu = document.querySelector(".menu");

    // Toggle visibility of menu labels and spans
    menuLabels.forEach(function (label) {
      label.classList.toggle("is-hidden");
    });
    menuListSpans.forEach(function (span) {
      span.classList.toggle("is-hidden");
    });

    // Toggle is-collapsed class on sidebar menu
    sidebarMenu.classList.toggle("is-collapsed");

    // Toggle is-fluid class on content area based on sidebar state
    if (sidebarMenu.classList.contains("is-collapsed")) {
      mainContent.classList.add("is-fluid");
    } else {
      mainContent.classList.remove("is-fluid");
    }
  });
```
