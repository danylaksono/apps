export function getMoonImageURLs(date = new Date(), southern = false) {
  /*
  ======================================================================
  https://observablehq.com/@forresto/the-moon-now
  current_moon.js
  
  Include this in the head node of the page.
  ====================================================================== */

  const moon_domain = "https://svs.gsfc.nasa.gov";
  const moon_year = date.getFullYear();

  const moon_info = {
    2022: {
      northern: {
        jpg: "/vis/a000000/a004900/a004955/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a004900/a004955/frames/5760x3240_16x9_30p/plain/",
      },
      southern: {
        jpg: "/vis/a000000/a004900/a004956/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a004900/a004956/frames/5760x3240_16x9_30p/plain/",
      },
      febdays: 28,
      nimages: 8760,
    },
    2023: {
      northern: {
        jpg: "/vis/a000000/a005000/a005048/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a005000/a005048/frames/5760x3240_16x9_30p/plain/",
      },
      southern: {
        jpg: "/vis/a000000/a005000/a005049/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a005000/a005049/frames/5760x3240_16x9_30p/plain/",
      },
      febdays: 28,
      nimages: 8760,
    },
    2024: {
      northern: {
        jpg: "/vis/a000000/a005100/a005187/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a005100/a005187/frames/5760x3240_16x9_30p/plain/",
      },
      southern: {
        jpg: "/vis/a000000/a005100/a005188/frames/730x730_1x1_30p/",
        tif: "/vis/a000000/a005100/a005188/frames/5760x3240_16x9_30p/plain/",
      },
      febdays: 29,
      nimages: 8760,
    },
  };

  if (!moon_info[moon_year]) {
    throw new Error("We don't have paths for that year yet.");
  }

  /*
  ======================================================================
  get_moon_imagenum()
  
  Initialize the frame number.  If the current date is within the year
  moon_year, the frame number is the (rounded) number of hours since the
  start of the year.  Otherwise it's 1.
  ====================================================================== */

  const year = date.getUTCFullYear();
  const { moon_nimages } = moon_info[year];
  const janone = Date.UTC(year, 0, 1, 0, 0, 0);
  let moon_imagenum = 1 + Math.round((date.getTime() - janone) / 3600000.0);
  if (moon_imagenum > moon_nimages) {
    moon_imagenum = moon_nimages;
  }

  const filename = "moon." + String(moon_imagenum).padStart(4, "0");

  function moon_image_url(filetype) {
    const moon_path =
      moon_info[moon_year][southern ? "southern" : "northern"][filetype];

    return moon_domain + moon_path + filename + "." + filetype;
  }

  return {
    jpg: moon_image_url("jpg"),
    tif: moon_image_url("tif"),
  };
}
