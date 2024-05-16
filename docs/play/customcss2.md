---
theme: dashboard
title: Test custom css
toc: false
sidebar: false
style: "https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
---

<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,300italic,700,700italic">
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bulma@1.0.0/css/bulma.min.css"
>

<style>
    .menu {
      position: sticky;
      display: inline-block;
      vertical-align: top;
      max-height: 100vh;
      overflow-y: auto;
      width: 300px;
      top: 0;
      bottom: 0;
      padding: 30px;
    }
    .content {
      display: inline-block;
    }
  </style>

<div class="is-widescreen">
    <div class="columns">
      <aside class="menu">
        <p class="menu-label">General</p>
        <ul class="menu-list">
          <li><a>Dashboard</a></li>
          <li><a>Customers</a></li>
        </ul>
        <p class="menu-label">Administration</p>
        <ul class="menu-list">
          <li><a>Team Settings</a></li>
          <li>
            <a class="is-active">Manage Your Team</a>
            <ul>
              <li><a>Members</a></li>
              <li><a>Plugins</a></li>
              <li><a>Add a member</a></li>
            </ul>
          </li>
          <li><a>Invitations</a></li>
          <li><a>Cloud Storage Environment Settings</a></li>
          <li><a>Authentication</a></li>
        </ul>
        <p class="menu-label">Transactions</p>
        <ul class="menu-list">
          <li><a>Payments</a></li>
          <li><a>Transfers</a></li>
          <li><a>Balance</a></li>
        </ul>
      </aside>
      <div class="column content">
        <div class="container">
          <div class="notification is-primary">
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
