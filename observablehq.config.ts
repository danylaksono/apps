// See https://observablehq.com/framework/config for documentation.
export default {
  // The project’s title; used in the sidebar and webpage titles.
  title: "Web-Apps",

  // The pages and sections in the sidebar. If you don’t specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  pages: [
    {
      name: "Projects",
      pages: [
        { name: "Dashboard", path: "/moonsighting" },
        { name: "Gridded-glyphmaps", path: "/gridded" },
        { name: "Yearpicker", path: "/yearpicker" },
        { name: "Investigate DuckDB", path: "/investiduck" },
        { name: "Obs Layout", path: "/layout" },
        { name: "Scrolly", path: "/scroll" },
        { name: "Morpher", path: "/morph" },
        { name: "Histogram", path: "/histograms" },
      ],
    },
  ],

  // Some additional configuration options and their defaults:
  // theme: "default", // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  footer: "", // what to show in the footer (HTML)
  // toc: true, // whether to show the table of contents
  pager: false, // whether to show previous & next links in the footer
  // root: "docs", // path to the source root for preview
  // output: "dist", // path to the output root for build
  // search: true, // activate search
};
