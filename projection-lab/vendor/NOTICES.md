# Bundled third-party code

These files are vendored so the app runs with no network access and no build
step. They are unmodified distribution builds.

| File | Package | Version | Licence |
| --- | --- | --- | --- |
| `d3.min.js` | [d3](https://github.com/d3/d3) | 7.9.0 | ISC — © Mike Bostock |
| `d3-geo-projection.min.js` | [d3-geo-projection](https://github.com/d3/d3-geo-projection) | 4.0.0 | ISC — © Mike Bostock, © Ricky Reusser |
| `topojson-client.min.js` | [topojson-client](https://github.com/topojson/topojson-client) | 3.1.0 | ISC — © Mike Bostock |

`../data/world-110m.js` and `../data/countries-50m.json` come from
[world-atlas](https://github.com/topojson/world-atlas) 2.0.2 (ISC), built from
[Natural Earth](https://www.naturalearthdata.com/) data, which is in the public
domain.

`../src/versor.js` is a local port of Mike Bostock's
[versor](https://github.com/Fil/versor) (ISC).
