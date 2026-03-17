---
theme: dashboard
title: Test custom css
toc: false
sidebar: false
# style: "https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
---

<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,300italic,700,700italic">
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
>

<style>
:root {
  --font-color: #ffffff;
  --font-dark-color: #949ba2;
  --font-darker-color: #5b646d;
  --highlight-color: #ffa500;
  --main-color: #2e323b;
  --sidebar-width: 13rem;
  --header-height: 3.25rem;
  --padding: 2rem;
}

html {
  overflow-y: auto;
}

body {
  color: var(--font-color);
}

.sidebar {
  padding-left: calc(var(--padding) - 0.75rem);
  padding-right: calc(var(--padding) - 0.75rem);
  position: absolute;
}

.sidebar .category-header {
  padding: 0.5em 0.75em;
}

.sidebar .menu {
  position: fixed;
  width: calc(var(--sidebar-width) - 2.5rem);
  max-width: inherit;
}

.sidebar .menu-list a {
  font-size: 0.875rem;
  line-height: 24px;
  color: var(--font-dark-color);
}

.sidebar:before {
  content: "";
  background-color: var(--main-color); /* Replace with the darker color */
  width: var(--sidebar-width);
  position: fixed;
}

.sidebar,
.sidebar:before {
  top: 0;
  bottom: 0;
  left: 0;
}

.main {
  margin-left: var(--sidebar-width);
  position: relative;
  padding-left: var(--padding);
  padding-right: var(--padding);
}

.main header {
  line-height: 18px;
}

.main header h2 {
  font-size: 24px;
  font-weight: 600;
  padding-bottom: 0.5rem;
}

.main header hr {
  background-color: transparent;
  border-top: 1px solid var(--main-color); /* Replace with the lighter color */
}

.main header small {
  color: var(--font-dark-color);
  text-align: right;
}

.main:before {
  content: "";
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: -2;
  left: 0;
  right: 0;
  background-image: radial-gradient(
    circle at top,
    var(--main-color) 0%, /* Replace with the lighter color */
    var(--main-color) 70% /* Replace with the darker color */
  );
  background-position: 50%, 50%;
}

.sidebar,
.main {
  margin-top: var(--header-height);
  padding-top: var(--padding);
}

.navbar {
  box-shadow: 0px 0px 21px var(--main-color); /* Replace with the darker color */
}

.navbar-brand {
  width: var(--sidebar-width);
  background-color: var(--highlight-color);
  margin-right: calc(var(--padding) - 0.75rem);
}

.navbar-brand .navbar-item {
  padding-left: var(--padding);
}

.box hr {
  background-color: var(--main-color); /* Replace with the lighter color */
}

.box.transparent {
  background-color: transparent;
}

.box.accent {
  background-color: var(--highlight-color);
}

.box.accent .subtitle {
  color: var(--font-color);
}

.statcard {
  font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
  text-align: center;
}

.statcard .statcard-number {
  font-size: 2rem;
  font-weight: 300;
  line-height: 1.125;
}

.statcard .statcard-desc {
  font-size: 85%;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--font-dark-color);
}

.statcard .delta-indicator {
  display: inline-block;
  padding: .4em;
  font-size: 12px;
  vertical-align: middle; 
}

.statcard .delta-indicator:after {
  content: "";
  display: inline-block;
  width: 0;
  height: 0;
  margin-left: 2px;
  margin-left: 2px;
  vertical-align: middle;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent; 
}

</style>

```js
document.addEventListener("DOMContentLoaded", () => {
  // Get all "navbar-burger" elements
  const $navbarBurgers = Array.prototype.slice.call(
    document.querySelectorAll(".navbar-burger"),
    0
  );

  // Check if there are any navbar burgers
  if ($navbarBurgers.length > 0) {
    // Add a click event on each of them
    $navbarBurgers.forEach((el) => {
      el.addEventListener("click", () => {
        // Get the target from the "data-target" attribute
        const target = el.dataset.target;
        const $target = document.getElementById(target);

        // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
        el.classList.toggle("is-active");
        $target.classList.toggle("is-active");
      });
    });
  }
});
```

<nav class="navbar is-fixed-top" role="navigation" aria-label="main navigation">
  <div class="navbar-brand">
    <a href="#" class="navbar-item">
      <img src="https://bulma.io/images/bulma-logo-white.png" width="112" height="28">
    </a>
    <a role="button" class="navbar-burger burger" aria-label="menu" aria-expanded="false" data-target="navbar-example">
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
    </a>
  </div>

  <div id="navbar-example" class="navbar-menu">
    <div class="navbar-start">
      <a class="navbar-item is-tab">Home</a>
      <a class="navbar-item is-tab ">Features</a>
      <a class="navbar-item is-tab">Documentation</a>
    </div>
    <div class="navbar-end">
      <div class="navbar-item">
        <div class="buttons">
          <a class="button is-light">
            Log in
          </a>
        </div>
      </div>
    </div>
  </div>
</nav>

<div class="wrapper">
  <div class="">
    <aside class="sidebar">
      <nav class="menu">
        <div class="menu-category">
          <header class="category-header">Dashboard</header>
          <ul class="menu-list">
            <li><a>Static</a></li>
            <li><a>Streaming</a></li>
          </ul>
        </div>
        <div class="menu-category">
          <header class="category-header">Elements</header>
          <ul class="menu-list">
            <li><a>Box</a></li>
            <li><a>Button</a></li>
            <li><a>Content</a></li>
            <li><a>Delete</a></li>
            <li><a>Icon</a></li>
            <li><a>Image</a></li>
            <li><a>Notification</a></li>
            <li><a>Progress bars</a></li>
            <li><a>Table</a></li>
            <li><a>Tag</a></li>
            <li><a>Title</a></li>
          </ul>
        </div>
        <div class="menu-category">
          <header class="category-header">Components</header>
          <ul class="menu-list">
            <li><a>Panels</a></li>
            <li><a>Breadcrumb</a></li>
            <li><a>Card</a></li>
            <li><a>Dropdown</a></li>
            <li><a>Menu</a></li>
            <li><a>Message</a></li>
            <li><a>Modal</a></li>
            <li><a>Navbar</a></li>
            <li><a>Pagination</a></li>
            <li><a>Panel</a></li>
            <li><a>Tabs</a></li>
          </ul>
        </div>
        <div class="menu-category">
          <header class="category-header">Pages</header>
          <ul class="menu-list">
            <li><a>Login</a></li>
            <li><a>Logout</a></li>
            <li><a>Page not found</a></li>
          </ul>
        </div>
      </nav>
    </aside>
    <main class="main">
      <header class="is-clearfix">
        <div class="cats is-pulled-right has-text-right">
          <small>Bulma Theme<br>Dashboard<br> <span class="has-text-weight-bold has-text-white">v.0.1</span></small>
        </div>
        <div>
          <h2>Dashboard</h2>
          <small>Dashboard sdff sdfdsfdsf cvfvxgfd</small>
        </div>
        <hr></hr>
      </header>
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">329</p>
            <p class="subtitle">Total Visits</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">+20 %</p>
            <p class="subtitle">Total Page Views</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">201</p>
            <p class="subtitle">Unique Visitor</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">12 %</p>
            <p class="subtitle">Purchases</p>
          </article>
        </div>
      </div>
      <header class="is-clearfix">
        <div class="cats is-pulled-right has-text-right">
          <small>Bulma Theme<br>Dashboard<br> <span class="has-text-weight-bold has-text-white">v.0.1</span></small>
        </div>
        <div>
          <h2>Bulma Boxes</h2>
          <small>Dashboard sdff sdfdsfdsf cvfvxgfd</small>
        </div>
        <hr></hr>
      </header>
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <article class="tile is-child box transparent">
            <p class="title">329</p>
            <p class="subtitle">Total Visits</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">+20 %</p>
            <p class="subtitle">Total Page Views</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <p class="title">201</p>
            <p class="subtitle">Unique Visitor</p>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box accent">
            <p class="title">-12 %</p>
            <p class="subtitle">Purchases</p>
          </article>
        </div>
      </div>
      <header class="is-clearfix">
        <div class="cats is-pulled-right has-text-right">
          <small>Dashboard Theme<br>Bulma Elements<br> <span class="has-text-weight-bold has-text-white">v.7.2</span></small>
        </div>
        <div>
          <h2>Bulma Elements</h2>
          <small>Bulma Elements are essential interface elements<br/> that only require a single CSS class.</small>
        </div>
        <hr></hr>
      </header>
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <article class="tile is-child box">
            <div>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><a href="#">Bulma</a></li>
                  <li><a href="#">Components</a></li>
                  <li class="is-active"><a href="#" aria-current="page">Breadcrumb</a></li>
                </ul>
              </nav>
              <div class="content">
                <p>A simple breadcrumb component to improve your navigation experience.</p>
              </div>
            </div>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <div class="tabs is-centered">
              <ul>
                <li><a>Elements</a></li>
                <li class="is-active"><a>Components</a></li>
                <li><a>Widgets</a></li>
                <li><a>Tiles</a></li>
              </ul>
            </div>
            <div class="content">
              <p>Simple responsive horizontal navigation tabs, with different styles.</p>
            </div>
          </article>
        </div>
      </div>
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <article class="tile is-child box">
            <nav class="pagination" role="navigation" aria-label="pagination">
              <a class="pagination-previous">Previous</a>
              <a class="pagination-next">Next page</a>
              <ul class="pagination-list">
                <li>
                  <a class="pagination-link" aria-label="Goto page 1">1</a>
                </li>
                <li>
                  <span class="pagination-ellipsis">&hellip;</span>
                </li>
                <li>
                  <a class="pagination-link" aria-label="Goto page 45">45</a>
                </li>
                <li>
                  <a class="pagination-link is-current" aria-label="Page 46" aria-current="page">46</a>
                </li>
                <li>
                  <a class="pagination-link" aria-label="Goto page 47">47</a>
                </li>
                <li>
                  <span class="pagination-ellipsis">&hellip;</span>
                </li>
                <li>
                  <a class="pagination-link" aria-label="Goto page 86">86</a>
                </li>
              </ul>
            </nav>
          </article>
        </div>
      </div>
      <header class="is-clearfix">
        <div class="cats is-pulled-right has-text-right">
          <small>Bulma Theme<br>Dashboard<br> <span class="has-text-weight-bold has-text-white">v.0.1</span></small>
        </div>
        <div>
          <h2>Custom Stat Cards</h2>
          <small>Custom stat cards to easily display large numbers, <br/>great for any kind of simple metrics and dashboard content.</small>
        </div>
        <hr></hr>
      </header>
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <article class="tile is-child box transparent">
            <div class="statcard">
              <h3 class="statcard-number">28,745</h3>
              <span class="statcard-desc">Page views</span>
            </div>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box transparent">
            <div class="statcard">
              <h3 class="statcard-number">
                72,134
                <small class="delta-indicator delta-positive">5%</small>
              </h3>
              <span class="statcard-desc">Page views</span>
            </div>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box">
            <div class="statcard">
              <h3 class="statcard-number">12,938</h3>
              <span class="statcard-desc">Page views</span>
            </div>
          </article>
        </div>
        <div class="tile is-parent">
          <article class="tile is-child box accent">
            <div class="statcard">
              <h3 class="statcard-number">12,938</h3>
              <span class="statcard-desc">Page views</span>
            </div>
          </article>
        </div>
      </div>
    </main>
  </div>
</div>
