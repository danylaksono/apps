import * as Astronomy from "../../_npm/astronomy-engine@2.1.19/_esm.js";

export function calculate(
  latitude,
  longitude,
  altitude = 0,
  baseTime,
  options = {}
) {
  const {
    evening = true,
    yallop = true,
    drawMoonLine = null,
    resultTime = null,
    qValue = null,
  } = options;

  // const astroTime = new Astronomy.AstroTime(baseTime);
  let details = {};

  baseTime = Astronomy.MakeTime(baseTime);
  const observer = new Astronomy.Observer(latitude, longitude, altitude);
  const time = baseTime.AddDays(-observer.longitude / 360);

  // console.log("time", time);

  const direction = evening ? -1 : 1;
  const sunsetSunrise = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    observer,
    direction,
    time,
    1
  );
  const moonsetMoonrise = Astronomy.SearchRiseSet(
    Astronomy.Body.Moon,
    observer,
    direction,
    time,
    1
  );

  if (sunsetSunrise == null || moonsetMoonrise == null) details.qcode = "H"; // No sun{set,rise} or moon{set,rise}

  // return sunsetSunrise;
  // const time = astroTime; //astroTime.AddDays(baseTime);
  // let lagTime;
  // let bestTime;
  // if (moonset.ut < sunset.ut) {
  //     lagTime = moonset.ut - sunset.ut;
  //     bestTime = sunset;
  // } else {
  //     lagTime = sunset.ut - moonset.ut;
  //     bestTime = new Astronomy.Time(sunset.ut + lagTime * 4 / 9);
  // }

  let bestTime;
  const lagTime = (moonsetMoonrise.ut - sunsetSunrise.ut) * (evening ? 1 : -1);
  bestTime =
    lagTime < 0
      ? sunsetSunrise.date
      : sunsetSunrise.AddDays(((lagTime * 4) / 9) * (evening ? 1 : -1));

  if (resultTime) resultTime.ut = bestTime.ut;

  if (details) {
    details.lagTime = lagTime;
    details.moonsetMoonrise = moonsetMoonrise.date;
    details.sunsetSunrise = sunsetSunrise.date;
  }

  // return bestTime;

  const newMoonPrev = Astronomy.SearchMoonPhase(
    0,
    sunsetSunrise.date,
    -35
  ).date;
  const newMoonNext = Astronomy.SearchMoonPhase(
    0,
    sunsetSunrise.date,
    +35
  ).date;
  const newMoonNearest =
    sunsetSunrise.ut - newMoonPrev.ut <= newMoonNext.ut - sunsetSunrise.ut
      ? newMoonPrev
      : newMoonNext;

  if (details) {
    details.newMoonPrev = newMoonPrev;
    details.newMoonNext = newMoonNext;
  }

  // return newMoonNearest;

  if (drawMoonLine)
    drawMoonLine =
      Math.round((bestTime.ut - newMoonNearest.ut) * 24 * 20) % 20 === 0;

  if (details) {
    details.moonAgePrev = bestTime.ut - newMoonPrev.ut;
    details.moonAgeNext = bestTime.ut - newMoonNext.ut;
  }

  const beforeNewMoon =
    (sunsetSunrise.ut - newMoonNearest.ut) * (evening ? 1 : -1) < 0;
  if (lagTime < 0 && beforeNewMoon) details.qcode = "J"; // Checks both conditions, shows a mixed color
  if (lagTime < 0) details.qcode = "I"; // Moonset before sunset / Moonrise after sunrise
  if (beforeNewMoon) details.qcode = "G"; // Sunset is before new moon / Sunrise is after new moon

  const sunEquator = Astronomy.Equator(
    Astronomy.Body.Sun,
    bestTime,
    observer,
    true, // equator of date
    true // correct abberation
  );
  const sunHorizon = Astronomy.Horizon(
    bestTime,
    observer,
    sunEquator.ra,
    sunEquator.dec,
    null // "normal" // for meeus refraction correction
  );
  const moonEquator = Astronomy.Equator(
    Astronomy.Body.Moon,
    bestTime,
    observer,
    true, // equator of date
    true // correct abberation
  );
  const moonHorizon = Astronomy.Horizon(
    bestTime,
    observer,
    moonEquator.ra,
    moonEquator.dec,
    null // no refraction
  );
  const libration = Astronomy.Libration(bestTime);

  // console.log("libration", libration);

  const SD = (libration.diam_deg * 60) / 2; // Semi-diameter of the Moon in arcminutes, geocentric
  const lunarParallax = SD / 0.27245; // In arcminutes
  // As SD_topo should be in arcminutes as SD, but moon_alt and lunar_parallax are in degrees, it is divided by 60.
  const SDTopo =
    SD *
    (1 +
      Math.sin(moonHorizon.altitude * Astronomy.DEG2RAD) *
        Math.sin((lunarParallax / 60) * Astronomy.DEG2RAD));

  const ARCL = yallop
    ? Astronomy.Elongation(Astronomy.Body.Moon, bestTime).elongation // Geocentric elongation in Yallop
    : Astronomy.AngleBetween(sunEquator.vec, moonEquator.vec).angle; // Topocentric elongation in Odeh

  // console.log("ARCL", ARCL);

  const DAZ = sunHorizon.azimuth - moonHorizon.azimuth;

  // console.log("SDTopo", SDTopo);

  let ARCV;
  if (yallop) {
    const geoMoon = Astronomy.GeoVector(Astronomy.Body.Moon, bestTime, true);
    const geoSun = Astronomy.GeoVector(Astronomy.Body.Sun, bestTime, true);
    const rot = Astronomy.Rotation_EQJ_EQD(bestTime);
    // console.log(rot);
    const rotMoon = Astronomy.RotateVector(rot, geoMoon);
    const rotSun = Astronomy.RotateVector(rot, geoSun);
    const meq = Astronomy.EquatorFromVector(rotMoon);
    const seq = Astronomy.EquatorFromVector(rotSun);
    const mhor = Astronomy.Horizon(
      bestTime,
      observer,
      meq.ra,
      meq.dec,
      null // Astronomy.REFRACTION_NONE
    );
    const shor = Astronomy.Horizon(
      bestTime,
      observer,
      seq.ra,
      seq.dec,
      null // Astronomy.REFRACTION_NONE
    );
    ARCV = mhor.altitude - shor.altitude;
  } else {
    // Odeh
    let COSARCV =
      Math.cos(ARCL * Astronomy.DEG2RAD) / Math.cos(DAZ * Astronomy.DEG2RAD);
    if (COSARCV < -1) COSARCV = -1;
    else if (COSARCV > +1) COSARCV = +1;
    ARCV = Math.acos(COSARCV) * Astronomy.RAD2DEG;
  }
  const WTopo = SDTopo * (1 - Math.cos(ARCL * Astronomy.DEG2RAD)); // In arcminutes

  // console.log("WTopo", WTopo);

  let result = " ";
  let value;
  if (yallop) {
    value =
      (ARCV -
        (11.8371 -
          6.3226 * WTopo +
          0.7319 * Math.pow(WTopo, 2) -
          0.1018 * Math.pow(WTopo, 3))) /
      10;
    if (value > +0.216) result = "A"; // Crescent easily visible
    else if (value > -0.014)
      result = "B"; // Crescent visible under perfect conditions
    else if (value > -0.16)
      result = "C"; // May need optical aid to find crescent
    else if (value > -0.232)
      result = "D"; // Will need optical aid to find crescent
    else if (value > -0.293)
      result = "E"; // Crescent not visible with telescope
    else result = "F";
  } else {
    // Odeh
    value =
      ARCV -
      (7.1651 -
        6.3226 * WTopo +
        0.7319 * Math.pow(WTopo, 2) -
        0.1018 * Math.pow(WTopo, 3));
    if (value >= 5.65) result = "A"; // Crescent is visible by naked eye
    else if (value >= 2.0) result = "C"; // Crescent is visible by optical aid
    else if (value >= -0.96)
      result = "E"; // Crescent is visible only by optical aid
    else result = "F";
  }
  if (qValue) qValue = value;

  // console.log("value", value);

  details.qcode = result;
  details.bestTime = bestTime;
  details.sd = SD;
  details.lunarParallax = lunarParallax;
  details.arcl = ARCL;
  details.arcv = ARCV;
  details.daz = DAZ;
  details.wTopo = WTopo;
  details.sdTopo = SDTopo;
  details.value = value;
  (details.moonAzimuth = moonHorizon.azimuth),
    (details.moonAltitude = moonHorizon.altitude);
  details.moonRa = moonHorizon.ra;
  details.moonDec = moonHorizon.dec;
  details.sunAzimuth = sunHorizon.azimuth;
  details.sunAltitude = sunHorizon.altitude;
  details.sunRa = sunHorizon.ra;
  details.sunDec = sunHorizon.dec;

  return details;
}
