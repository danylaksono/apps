# apps

This repository hosts small web demos and interactive examples. The old Observable Framework site is now archived under `archive/observablehq`.

## Live demo (GitHub Pages)

The project is published to GitHub Pages at:

- https://danylaksono.github.io/apps/

This site includes:

- **City Rose** (React + Vite) — `/apps/city-rose/`
- **Walk (Isochrone)** (static JS) — `/apps/walk/`
- **Sector 7** (canvas game) — `/apps/sector7/`
- **Archived ObservableHQ site** — `/apps/archive/observablehq/`

## Local development

### City Rose (React + Vite)

```bash
cd city-rose
npm install
npm run dev
```

Then open http://localhost:5173/.

### Walk (static)

Open `walk/walk.html` in your browser (no build step required).

### Sector 7 (static)

Open `sector7/index.html` in your browser.

## Archival content

The previous Observable Framework project (pages and build artifacts) is preserved under:

- `archive/observablehq/`

You can explore those files for reference, but they are no longer part of the actively maintained deployment.

## Adding a new project

If you want to add another standalone demo/app in its own subdirectory (e.g., `new-project/`), follow these steps:

1. Create the project folder and add your source/build files (including its own `package.json` if it uses npm).
2. Update `index.html` to add a link to the new project so it appears on the landing page.
3. Update `.github/workflows/main.yml` to build (if needed) and copy the project into the deploy output.

Example workflow snippet to build and publish a new Vite project under `new-project/`:

```yaml
- name: Install & build new-project
  run: |
    cd new-project
    npm ci
    npm run build

- name: Copy new-project build
  run: |
    mkdir -p deploy/new-project
    cp -R new-project/dist/* deploy/new-project/
```

If the project is static (no build step), you can just copy the folder:

```bash
cp -R my-static-app deploy/my-static-app
```
