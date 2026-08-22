# Agni Forest Fire Investigation

This file records two studies of fire in Indonesian forestry concessions. Both
use the data sources that the Agni app already reads.

Section 1 measures all 307 concessions in Kalimantan. Section 2 examines one of
them closely. The scripts are in [`scripts/`](scripts/).

Nothing here is an accusation. Each number states what a satellite recorded
inside a boundary line. Section 1.10 and section 2.8 list what the data cannot
show.

**Words used in one sense only**

| word        | meaning here                                               |
| ----------- | ---------------------------------------------------------- |
| concession  | the area of one forestry permit                            |
| permit      | the legal document, and its class (HA, HTI, RE)            |
| detection   | one VIIRS thermal record, at one place, at one time        |
| canopy loss | loss of tree cover, as UMD/Hansen records it               |
| excess      | how many times the regional fire rate a concession reaches |
| season      | 1 June to 30 November                                      |

---

# 1. Fire in Kalimantan concessions, 2013–2026

We ran this screen on 22 August 2026. It covers 307 IUPHHK permits in the five
Kalimantan provinces and 1,158,652 VIIRS detections.

## 1.1 Result

Concessions burn less than Kalimantan as a whole. They hold 29.8% of the land
and 15.8% of the fire. Their average rate is about half the rate of the island.
It is wrong to treat "concession" as another word for "fire".

A small group of concessions behaves differently. These burn far above the rate
of the land around them, and the gap is widening.

|                                          | count |
| ---------------------------------------- | ----: |
| IUPHHK permits in Kalimantan             |   307 |
| large enough to screen                   |   169 |
| at or above the regional rate, 2022–2026 |    62 |
| also 2 times worse than in 2013–2017     |    32 |
| also 3 times worse                       |    14 |

A concession is large enough to screen if it covers 5,000 ha or more and has 30
or more recent detections. Below that size, a few detections move the rate too
much.

## 1.2 How we measure fire

You cannot compare raw counts between years. The years 2015, 2019 and 2023 were
El Niño years. Everything burned more in those years.

So we divide each concession by the land around it, in the same seasons:

```
excess  =   detections per hectare in the concession
            ---------------------------------------
            detections per hectare on Kalimantan land
```

An excess of 1.0 means the concession burned like its surroundings. An excess of
5.0 means it burned five times as much.

Acceleration is the late excess divided by the early excess. It shows how much
worse a concession became against its own surroundings. Climate cancels out,
because both eras use the same regional denominator.

The early era is 2013–2017. The late era is 2022–2026. Each is five seasons.
Four years separate them.

The denominator uses the kab/kota outline in `public/data/`. This removes the
sea, Sarawak, Sabah and Brunei from the request box. Of the 1,158,652
detections, 1,107,912 fall on Indonesian Kalimantan. That land covers 53,399,786
ha.

## 1.3 Fire seasons in Kalimantan

VIIRS S-NPP detections on land, 1 June to 30 November:

| season   |  detections | per 100k ha |     | season   | detections | per 100k ha |
| -------- | ----------: | ----------: | :-: | -------- | ---------: | ----------: |
| 2013     |      59,142 |       110.8 |     | 2020     |     18,513 |        34.7 |
| 2014     |     172,804 |       323.6 |     | 2021     |     13,557 |        25.4 |
| **2015** | **356,784** |   **668.1** |     | 2022     |     10,630 |        19.9 |
| 2016     |      25,260 |        47.3 |     | **2023** | **85,537** |   **160.2** |
| 2017     |      17,127 |        32.1 |     | 2024     |     28,013 |        52.5 |
| 2018     |      62,298 |       116.7 |     | 2025     |     31,810 |        59.6 |
| **2019** | **171,779** |   **321.7** |     | 2026\*   |     54,658 |       102.4 |

\* to 22 August 2026. The season is not complete.

The 2026 season is unusual, and you must read it with care. Nusantara Atlas
recorded more than 96,000 hotspots across Indonesia by 27 July 2026. The same
period held about 88,000 in 2019 and about 58,000 in 2023. Zeke Hausfather puts
the chance at 90% that this El Niño becomes the strongest in about 150 years of
records.

A partial season does not change any excess figure. The numerator and the
denominator are short by the same amount.

## 1.4 Concessions with the most fire, 2022–2026

`excess` is the ratio to the regional rate. `was` is the same ratio for
2013–2017. `accel` is `excess` divided by `was`.

| concession                         |    prov    | class  |          ha | fire/100k ha |   excess |     was |   accel |
| ---------------------------------- | :--------: | :----: | ----------: | -----------: | -------: | ------: | ------: |
| PT DWIMA INTIGA                    |   Kalsel   |  HTI   |       9,403 |        8,316 | **21.1** |     3.3 |     6.3 |
| PT RIMBUN SERUYAN                  |  Kalteng   |  HTI   |      40,262 |        2,340 |      5.9 |     3.6 |     1.7 |
| PT GRACE PUTRI PERDANA             |  Kalteng   |  HTI   |      29,226 |        2,080 |      5.3 |     1.4 |     3.7 |
| PT WANAKERTA EKALESTARI            |   Kalbar   |  HTI   |      26,587 |        2,057 |      5.2 |     1.5 |     3.4 |
| PT LAHAN SUKSES                    |   Kalbar   |  HTI   |      14,308 |        1,915 |      4.9 |     1.7 |     2.9 |
| PT INHUTANI II TANAH GROGOT        |   Kaltim   |  HTI   |      17,031 |        1,738 |      4.4 |     3.7 |     1.2 |
| PT PRIMA BUMI SENTOSA              |   Kalbar   |  HTI   |      70,056 |        1,693 |      4.3 |     2.0 |     2.2 |
| PT INHUTANI III PELAIHARI          |   Kalsel   |  HTI   |      28,564 |        1,663 |      4.2 |     4.3 |     1.0 |
| PT DUTA BINTANG GEMILANG           |   Kalbar   |  HTI   |      17,141 |        1,598 |      4.1 |     1.1 |     3.6 |
| PT DUTA ANDALAN SUKSES             |   Kalbar   |  HTI   |      30,922 |        1,433 |      3.6 |     1.5 |     2.5 |
| **PT KIANI LESTARI**               | **Kaltim** | **HA** | **135,060** |    **1,331** |  **3.4** | **0.7** | **5.0** |
| PT RIMBA RAYA CONSERVATION         |  Kalteng   |   RE   |      37,135 |        1,301 |      3.3 |     5.7 |     0.6 |
| PT GAMBARU SELARAS ALAM            |   Kalbar   |  HTI   |      20,422 |        1,298 |      3.3 |     0.6 |     5.4 |
| PT FINNANTARA INTIGA               |   Kalbar   |  HTI   |     286,775 |        1,273 |      3.2 |     0.9 |     3.8 |
| PT MAHKOTA RIMBA UTAMA             |   Kalbar   |  HTI   |      74,450 |        1,220 |      3.1 |     1.6 |     1.9 |
| PT SANTAN BORNEO ABADI             |   Kaltim   |  HTI   |      36,651 |        1,187 |      3.0 |     0.8 |     4.0 |
| PT INHUTANI III (eks Inhutani III) |   Kalsel   |  HTI   |      14,914 |        1,187 |      3.0 |     2.0 |     1.5 |
| PT SUMALINDO HUTANI JAYA I         |   Kaltim   |  HTI   |      11,818 |        1,125 |      2.9 |     1.6 |     1.8 |
| PT WANA SUBUR PERSADA              |   Kalbar   |  HTI   |      42,342 |        1,124 |      2.8 |     1.5 |     1.9 |
| PT RIMBA EQUATOR PERMAI            |   Kalbar   |  HTI   |      18,004 |        1,039 |      2.6 |     1.1 |     2.3 |

PT Dwima Intiga is the highest in Kalimantan, at 21 times the regional rate. It
is a small concession in Kalsel. We did not examine it further.

PT Rimba Raya Conservation is different from the rest. It holds a restoration
permit, and its excess fell from 5.7 to 3.3. A restoration concession that
inherited a fire problem is not the same as a plantation that acquired one.

## 1.5 Concessions that got worse fastest

This table holds only concessions that now reach the regional rate. That is 62
of the 169 we screened. Without that limit, the table fills with concessions
that went from almost no fire to a little below average. A large ratio there
describes nothing.

| concession                   |    prov    | class  |          ha | fire/100k ha |  excess |     was |    accel |
| ---------------------------- | :--------: | :----: | ----------: | -----------: | ------: | ------: | -------: |
| PT DIVA PERDANA PESONA       |   Kaltim   |  HTI   |      48,262 |          864 |     2.2 |     0.1 | **22.3** |
| PT KELAWIT WANA LESTARI      |   Kaltim   |  HTI   |      27,238 |          613 |     1.6 |     0.2 |      8.5 |
| PT INHUTANI I UNIT SAMBARATA |   Kaltim   |   HA   |     109,587 |          574 |     1.5 |     0.2 |      7.7 |
| PT DWIMA INTIGA              |   Kalsel   |  HTI   |       9,403 |        8,316 |    21.1 |     3.3 |      6.3 |
| PT GAMBARU SELARAS ALAM      |   Kalbar   |  HTI   |      20,422 |        1,298 |     3.3 |     0.6 |      5.4 |
| **PT KIANI LESTARI**         | **Kaltim** | **HA** | **135,060** |    **1,331** | **3.4** | **0.7** |  **5.0** |
| PT INHUTANI III NANGAPINAH   |   Kalbar   |  HTI   |     124,603 |          629 |     1.6 |     0.4 |      4.0 |
| PT SANTAN BORNEO ABADI       |   Kaltim   |  HTI   |      36,651 |        1,187 |     3.0 |     0.8 |      4.0 |
| PT FINNANTARA INTIGA         |   Kalbar   |  HTI   |     286,775 |        1,273 |     3.2 |     0.9 |      3.8 |
| PT SINAR KALBAR RAYA         |   Kalbar   |  HTI   |      38,378 |          912 |     2.3 |     0.6 |      3.7 |
| PT GRACE PUTRI PERDANA       |  Kalteng   |  HTI   |      29,226 |        2,080 |     5.3 |     1.4 |      3.7 |
| PT DUTA BINTANG GEMILANG     |   Kalbar   |  HTI   |      17,141 |        1,598 |     4.1 |     1.1 |      3.6 |
| PT WANAKERTA EKALESTARI      |   Kalbar   |  HTI   |      26,587 |        2,057 |     5.2 |     1.5 |      3.4 |
| PT INTRACA HUTANI LESTARI    |  Kaltara   |  HTI   |      41,632 |          471 |     1.2 |     0.3 |      3.4 |
| PT NITIYASA IDOLA            |   Kalbar   |  HTI   |      98,846 |          903 |     2.3 |     0.8 |      3.0 |

## 1.6 Permit class and province

| group                      | permits |         ha | excess 2013–17 | excess 2022–26 |   accel |
| -------------------------- | ------: | ---------: | -------------: | -------------: | ------: |
| IUPHHK-HA (natural forest) |     161 | 10,322,403 |           0.25 |           0.34 |     1.4 |
| IUPHHK-HTI (plantation)    |     140 |  5,279,231 |           1.00 |           1.22 |     1.2 |
| IUPHHK-RE (restoration)    |       6 |    314,020 |           1.25 |           0.40 |     0.3 |
| Kalimantan Barat           |      68 |  3,074,447 |           0.79 |       **1.54** | **1.9** |
| Kalimantan Selatan         |      21 |    756,199 |           1.43 |           1.01 |     0.7 |
| Kalimantan Tengah          |      89 |  4,974,057 |           0.47 |           0.38 |     0.8 |
| Kalimantan Timur           |     100 |  5,016,405 |           0.43 |           0.44 |     1.0 |
| Kalimantan Utara           |      29 |  2,094,545 |           0.11 |           0.23 |     2.1 |

Each permit class behaves as its licence predicts. Plantation concessions burn
at about the rate of the land, because their operators clear and replant them by
design. Natural forest concessions burn at a third of that rate, because
standing forest does not catch fire easily. Restoration concessions improved.

This is a steady baseline. It is what lets one concession at ten times its own
class stand out.

Kalimantan Barat has the largest problem. Its concessions moved from below the
rate of the land to half again above it. It holds 38 of the 62 concessions above
the rate. Kalteng and Kalsel improved.

Read the Kaltara figure with care. Its acceleration of 2.1 is a rise from 0.11
to 0.23. That is still a quarter of the rate of the land. A ratio needs a level
beside it, so both columns appear here.

## 1.7 Canopy loss in the leaders

We measured UMD/Hansen canopy loss over each of the 25 concessions with the most
fire. The table lists them by hectares lost in 2023–2025, largest first.

| concession                   |      ha | loss 2001–25 | loss 2023–25 | ha lost 23–25 |
| ---------------------------- | ------: | -----------: | -----------: | ------------: |
| **PT KIANI LESTARI**         | 136,261 |        43.1% |    **17.8%** |    **24,254** |
| PT FINNANTARA INTIGA         | 289,170 |        42.1% |         6.3% |        18,218 |
| PT INHUTANI I (UNIT LABANAN) | 139,587 |        35.3% |         4.8% |         6,700 |
| PT GRACE PUTRI PERDANA       |  29,488 |        51.1% |    **19.3%** |         5,691 |
| PT NITIYASA IDOLA            |  99,825 |        37.7% |         5.5% |         5,490 |
| PT PRIMA BUMI SENTOSA        |  70,602 |        41.6% |         6.4% |         4,519 |
| PT MAHKOTA RIMBA UTAMA       |  74,998 |        31.3% |         5.2% |         3,900 |
| PT DUTA ANDALAN SUKSES       |  31,282 |        38.7% |         9.3% |         2,909 |
| PT WANA SUBUR PERSADA        |  42,760 |        39.9% |         6.7% |         2,865 |
| PT SINAR KALBAR RAYA         |  38,834 |        48.2% |         6.9% |         2,680 |
| PT SUMALINDO HUTANI JAYA I   |  11,938 |    **74.8%** |        13.7% |         1,635 |
| PT INHUTANI II TANAH GROGOT  |  17,210 |    **68.0%** |         7.2% |         1,239 |
| PT SANTAN BORNEO ABADI       |  36,968 |    **68.6%** |         2.8% |         1,035 |

Total loss above 40% is common here, and it is not remarkable by itself. A
plantation converts its whole area by design. Sumalindo Hutani Jaya I at 74.8%
and Santan Borneo Abadi at 68.6% are ordinary for their class.

Recent loss is the figure to watch. Only two concessions in this set lost more
than 17% of their area in three years. PT Kiani Lestari is one of them, and its
area is four times larger than the other. It therefore lost more hectares since
2023 than any concession we screened.

## 1.8 PT Kiani Lestari in this list

Section 2 examines this concession in detail. Against the island:

- It is 11th of 169 concessions by fire in 2022–2026.
- It is 6th of 62 by acceleration.
- It has the most fire of any IUPHHK-HA permit in Kalimantan. Its excess is
  3.37. The next is PT Inhutani I Unit Labanan at 2.62. The HA class average is
  0.34, so this concession sits at about ten times its own class.
- It lost the most hectares of canopy since 2023 of the 25 leaders.

It is not unique, and this file does not present it as unique. It is a severe
case of a pattern that affects dozens of concessions. It is also the case where
the permit class makes the behaviour hardest to explain, so we chose it as the
worked example.

## 1.9 Other work finds the same pattern

This screen is not the first to look for fire inside concessions. Its results
agree with published work, and other groups name some of the same companies.

**Concessions hold a large share of Indonesian fire.** Purnomo and others
studied hotspots in Sumatra and Kalimantan from 2001 to 2017. They found 47% of
hotspots in wood plantations, oil palm plantations and logging concessions, 31%
in conservation areas and 22% on community land. They also found that fire use
rose in the year before local elections.

**Other groups flag PT Grace Putri Perdana.** WALHI published an analysis on 31
March 2026. It found 11,189 hotspots in Indonesia between 1 January and 25 March
2026, and 1,351 of them in or beside the concessions of 15 companies. PT Grace
Putri Perdana is on that list. This screen puts the same company third for fire
and second for recent canopy loss, from different satellite data and a different
season. WALHI argues that repeated fire in the same concessions points to a
structural cause rather than to weather alone.

**Kalimantan Barat is in trouble by other measures too.** The provincial
forestry office reported about 28,680 ha burned and 17,236 hotspots to July
2026, the highest in Borneo, and sanctions against 159 companies. Section 1.6
reaches the same conclusion from a different direction.

**Clearing is concentrated where this screen puts it.** Nusantara Atlas reports
that West, Central and East Kalimantan hold more than 90% of Indonesian pulpwood
deforestation. It also reports that 81% of pulpwood deforestation between 2015
and 2024, or 118,030 ha, took place in concessions that do not supply the mills.

**The method has a precedent.** Pantau Gambut and HAkA found 395 hotspots in one
oil palm concession, PT Gelora Sawita Makmur, between 27 May and 5 June 2026.
They then used PlanetScope images to measure about 605 ha of burnt peat. They
concluded that the pattern of the fire, with field observation, points to land
clearing. Section 2 applies the same logic with a longer record.

## 1.10 What the screen cannot show

- **This is a screen, not a conclusion.** A high excess shows that satellites
  recorded fire inside a boundary more often than outside it. It does not show
  who lit the fire, or that anyone lit it, or that any law was broken. Section 2
  shows the further tests that a rank alone cannot replace. We ran those tests
  on one of these 307 permits.
- **A detection is not an area.** VIIRS records heat at the moment the satellite
  passes. A slow peat fire and a bright slash fire are not equal in the record.
  Cloud hides fire, and it does not hide it evenly across the island.
- **The season window omits early-year fire.** This screen reads 1 June to 30
  November. That window holds 94% of detections in the area of section 2. It
  misses the January to March fires that WALHI measured in 2026, which were
  severe in Kalimantan Barat. A study of early-season fire needs
  `--season 01-01,12-31`.
- **A permit polygon is not a permit status.** BIG publishes no status field.
  A revoked permit and a live permit look the same here. Section 2.3 shows why
  this matters.
- **Small concessions are absent, not innocent.** Below 5,000 ha, a few
  detections move the rate too much to rank.
- **A low concession rate is not innocence.** 84% of fire in Kalimantan falls
  outside these boundaries. It falls on smallholdings, on oil palm concessions
  that this permit layer does not hold, and on unallocated land. That is a
  larger problem than this one, and a different one.
- **2026 is an exceptional year.** Read every 2026 figure against the El Niño
  forecast in section 1.3.

## 1.11 How to repeat this

```sh
cd Docs/scripts
python fetch_data.py permits --cache ../data
python fetch_data.py firms   --cache ../data --bbox 108.60,-4.94,119.04,4.41
python screen_region.py --cache ../data --top 25 --loss \
    --csv ../data/kalimantan_concessions.csv
```

The FIRMS download is about 90 MB in 498 windows. It takes 20 to 40 minutes the
first time. You can stop it and start it again without loss. The screen itself
takes a few minutes. The CSV holds every permit, not only the rows printed
above. `Docs/data/` is in `.gitignore`.

---

# 2. PT Kiani Lestari

We ran this analysis on 22 August 2026, on the same data as section 1. It uses
NASA FIRMS, UMD/Hansen through GFW, and KLHK permit polygons through BIG
SatuPeta.

## 2.1 Why we selected this concession

Section 1 puts this concession first among natural forest permits in Kalimantan.
It is 11th of 169 overall for fire and 6th of 62 for acceleration.

Public reporting in 2024 also named PT Kiani Lestari as part of the forestry
group that Prabowo Subianto acquired in 2004. Satellite data can neither confirm
nor deny that. It can measure what happened inside the boundary, which is what
section 2.4 does.

## 2.2 The permit

| field      | value                                                                         | source                                             |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Class      | IUPHHK-HA, natural forest, not HTI                                            | BIG permit layers; SVLK audit                      |
| Decree     | `SK.434/Menhut-II/2012`, 9 August 2012, 45 years                              | BIG; SVLK audit                                    |
| Area       | 134,950 ha by decree, 135,061 ha measured                                     | BIG `lssk`; equal-area measurement                 |
| Place      | Muara Wahau, Telen, Muara Bengkal, Muara Ancalong, Batu Ampar, in Kutai Timur | SVLK audit; the polygon lies wholly in Kutai Timur |
| Renumbered | `SK.776/MENLHK/SETJEN/HPL.0/9/2021`, to PBPH                                  | SVLK audit                                         |
| Work plan  | RKUPH 2022–2031, `SK.7910/MenLHK-PHPL/UHP/HPL.1/12/2021`                      | SVLK audit                                         |

The measured area differs from the decree area by 0.08%. GFW holds an
independent copy of the same ministry polygon and reports 135,069.00 ha. The
boundary is accurate enough to measure against.

The permit class decides how to read section 2.4. The SVLK audit of 2023 states
that the company holds _"izin pemanfaatan hutan alam dan bukan hutan tanaman
industri"_. It marks the plantation check _Tidak diterapkan_ for that reason.
The licence is for selective logging, not for clearing and replanting.

## 2.3 Two records disagree

Two official records conflict. This file does not decide which one governs.

- **5 January 2022.** `SK.01/MENLHK/SETJEN/KUM.1/1/2022` revokes hundreds of
  forest concessions. PT Kiani Lestari appears on the list at 134,950 ha.
- **January 2022 and February 2023.** The company approves its own annual
  cutting plans. The audit records decision `05/SK/KL-JKT I/I/2022` for 2022 and
  decision `07/SK/KL-JKT I/II/2023` for 2023, both as self approval.
- **April 2022 to March 2023.** The company logs timber. It pays PSDH of
  Rp 168,532,420 and DR of USD 34,274.66, and settles arrears in February 2023.
- **3 to 10 April 2023.** An accredited SVLK body audits the company. The
  company passes, and receives a legality certificate for three years.
- **11 April 2023.** Local reporting describes villagers in Batu Ampar who are
  uneasy because PT Kiani Lestari has resumed logging after about 25 years. The
  report notes the revocation decree, and that a subcontractor does the work.

The BIG permit layer still serves the 2012 decree and shows no status field. A
revocation does not appear in the spatial data at all. Do not read the polygon
as proof of a valid permit.

## 2.4 Five tests

Each test would fail for a different reason if this fire were wildfire. The
method is in section 2.6.

### Test 1 — fire is 39 times the rate of the same permit class

Seven other IUPHHK-HA concessions share this licence class and this landscape.

| concession (IUPHHK-HA)       |      ha | fire/100k ha |   2023–26 | loss 01–25 | loss 23–25 |
| ---------------------------- | ------: | -----------: | --------: | ---------: | ---------: |
| **PT KIANI LESTARI**         | 136,261 |    **2,568** | **1,249** |  **43.1%** |  **17.8%** |
| PT Segara Indochem           |  61,089 |          226 |       139 |       8.2% |       1.4% |
| PT Panambangan               |  44,057 |          125 |        16 |      27.7% |      19.5% |
| PT Narkata Rimba             |  65,693 |           75 |        37 |       3.6% |       0.5% |
| PT Intertropic Aditama       |  45,301 |           22 |        20 |       4.1% |       0.8% |
| PT Oceanis Timber Product    |  66,787 |           21 |         9 |       2.2% |       0.3% |
| PT Gunung Gajah Abadi        |  73,637 |           12 |        11 |       4.5% |       1.0% |
| PT Kedung Madu Tropical Wood |  64,864 |            9 |         2 |       4.9% |       0.5% |
| **the other seven together** | 421,427 |       **67** |    **33** |   **7.0%** |   **2.7%** |

- All seasons: 2,568 against 67 per 100k ha. That is 39 times.
- 2023 onward: 1,249 against 33 per 100k ha. That is 38 times.
- Canopy loss 2001–2025: 43.1% against 7.0% of area.

Among all 23 concessions in the analysis box, of both classes, this one has the
most fire since 2023. That includes every plantation concession, and plantation
operators may clear and replant.

### Test 2 — fire stops at the boundary line

| band                     | area ha | detections | per 100k ha | 2023–26 per 100k ha |
| ------------------------ | ------: | ---------: | ----------: | ------------------: |
| inside, core beyond 3 km |  31,962 |        859 |       2,688 |               1,389 |
| inside, 1–3 km           |  61,567 |      1,584 |       2,573 |               1,308 |
| inside, 0–1 km           |  41,532 |      1,056 |       2,543 |               1,091 |
| outside, 0–1 km          |  43,474 |        602 |       1,385 |                 497 |
| outside, 1–3 km          |  78,324 |        672 |         858 |                 280 |
| outside, 3–6 km          |  98,258 |        864 |         879 |                 189 |

The rate is level across the whole interior. It then falls at the line: 2,543,
then 1,385, then 858. For 2023–2026 the fall across the line is 3.9 times, and
5.8 times against the ring at 3 to 6 km.

A wildfire does not know where the boundary is. Management does.

### Test 3 — fire sits on canopy lost in the same year

For each detection we read the Hansen loss years within about 400 m. The column
shows how often that year's loss fills at least a quarter of the window.

| season    | inside the concession | control ring |
| --------- | --------------------: | -----------: |
| 2013      |                   21% |          22% |
| 2015      |                   35% |          13% |
| 2019      |                   24% |          15% |
| 2022      |                   21% |           5% |
| **2023**  |               **55%** |          35% |
| **2024**  |               **62%** |          35% |
| **2025**  |               **57%** |          47% |
| 2013–2025 |               **41%** |          20% |

Read the same fact the other way. Of the area that lost canopy in each year,
this much burned in that same year:

| year         | 2015 | 2023 | 2024 | 2025 | 2013–2025 |
| ------------ | ---: | ---: | ---: | ---: | --------: |
| share burned |  65% |  52% |  33% |  35% |       31% |

Across 2013–2025 that is 16,190 ha of 51,664 ha.

### Test 4 — fire arrives in bursts

The concession holds 3,499 detections on 660 separate days.

| detections in one day | days | detections | share |
| --------------------- | ---: | ---------: | ----: |
| 1                     |  191 |        191 |    5% |
| 2–4                   |  235 |        648 |   19% |
| 5–9                   |  140 |        922 |   26% |
| 10–19                 |   62 |        821 |   23% |
| 20 or more            |   32 |        917 |   26% |

95% of detections fall on days that carry more than one fire. 49% fall on days
that carry ten or more. The largest days are 19 August 2026 with 66, 13
September 2024 with 58, 24 October 2015 with 47, and 6 August 2026 with 43.

### Test 5 — no other permit overlaps

We intersected this polygon with every IUPHHK-HA and IUPHHK-HTI polygon in
Kalimantan Timur. There is no overlap. Six HTI concessions touch the edge. None
share area. No other permit holder can account for this canopy loss.

### Canopy loss by year

| period    |   loss ha | period   |   loss ha |
| --------- | --------: | -------- | --------: |
| 2001–2010 |     4,442 | 2018     |     2,350 |
| 2011      |     1,424 | 2019     |     1,845 |
| 2012      |     1,195 | 2020     |     1,906 |
| 2013      |     1,096 | 2021     |     1,616 |
| 2014      |     1,899 | 2022     |     1,987 |
| 2015      |     3,192 | **2023** | **7,165** |
| **2016**  | **9,277** | **2024** | **8,586** |
| 2017      |     2,253 | **2025** | **8,491** |

The concession has lost 58,723 ha of canopy since 2001. That is 43.1% of its
area.

The record holds two different periods. Fire drove the peak of 2015 and 2016,
the El Niño years: 666 detections, then 9,277 ha of loss recorded in 2016. From
2023 the loss runs at 7,000 to 8,600 ha each year, with heavy fire throughout.
The last three years hold 41% of all loss since 2001.

### The concession is burning now

We retrieved VIIRS S-NPP NRT data on 22 August 2026. The concession held 162
detections in the previous six days, and 1,035 MW of cumulative FRP. By day from
17 August the counts are 4, 29, 66, 16, 22 and 25.

19 August 2026 is the largest single day of fire inside this boundary in the
14-year record.

The 2026 season already holds 484 detections, or 358 per 100k ha. The
surrounding ring holds 551 detections, or 71 per 100k ha. That is 5.0 times. The
dry season is not over, and 2025 held 428 detections in its whole season.

## 2.5 Dates

These are dated records in sequence. This list does not claim that one event
caused another.

| date               | event                                                                                 | source          |
| ------------------ | ------------------------------------------------------------------------------------- | --------------- |
| 9 Aug 2012         | IUPHHK-HA granted, 134,950 ha, 45 years                                               | decree, BIG     |
| 2013–2022          | canopy loss averages about 1,900 ha a year; fire near the rate of the land until 2017 | this analysis   |
| 9 Sep 2021         | permit renumbered to PBPH                                                             | SVLK audit      |
| Dec 2021           | RKUPH 2022–2031 approved                                                              | SVLK audit      |
| 5 Jan 2022         | permit listed as revoked in `SK.01/2022`                                              | decree          |
| Jan 2022, Feb 2023 | company approves its own cutting plans                                                | SVLK audit      |
| Apr 2023           | SVLK audit passes; local reports of logging resuming in Batu Ampar                    | audit, Mitrapol |
| 2023–2025          | canopy loss rises to 7,165, then 8,586, then 8,491 ha a year                          | this analysis   |
| 2023–2026          | fire reaches 38 times the other HA concessions                                        | this analysis   |
| 19 Aug 2026        | largest single day of fire on record inside the boundary                              | this analysis   |

## 2.6 Method

- **FIRMS VIIRS S-NPP.** SP archive to 30 April 2026, NRT after that. We pulled
  all Kalimantan (section 1.11) and filtered to `116.10,0.10,117.90,1.70` here.
  That gives 39,483 detections in the 1 June to 30 November seasons, which hold
  94% of detections in this area.
- **UMD/Hansen canopy loss v1.13** (`tcd_30`). We decode GFW's encoded PNG tiles
  at zoom 12, about 19 m for each pixel. The blue channel holds the loss year.
  `src/lib/gfwRaster.ts` decodes it the same way for the map.
- **Permit polygons.** BIG SatuPeta `PERIZINAN_DAN_PERTANAHAN`, layer 1
  (`IUPHHKHA`) and layer 2 (`IUPHHKHTI`), at `maxAllowableOffset=0.0005`.
- **Forest estate.** BIG `KEHUTANAN` layer 0. The concession is 72.1% HP, 27.2%
  HPT and 0.8% outside the gazetted estate.
- **Areas.** Azimuthal equal-area projection, centred on 0.9 N, 117.0 E.
- **Comparison set.** The 22 other IUPHHK concessions that lie 60% or more
  inside the analysis box. With the target that is 23: eight HA and 15 HTI.

To repeat section 2:

```sh
cd Docs/scripts
python analyze_concession.py --cache ../data --name "KIANI LESTARI" \
    --ring-bbox 116.60,0.45,117.45,1.32 --peer-bbox 116.20,0.20,117.80,1.60
```

It reads the cache that section 1.11 fills, so it needs no new download.

## 2.7 Three different companies

Most published accounts merge three things. The permit data separates them.

| entity                                         | what it is                                      | where                               |
| ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| PT Kiani Kertas, now **PT Kertas Nusantara**   | the pulp mill, 525,000 t a year                 | Mangkajang, in **Berau**            |
| **PT Kiani Lestari**                           | IUPHHK-HA, 134,950 ha, the subject of section 2 | **Kutai Timur**                     |
| the 200,000 ha of HTI in Jusuf Kalla's account | plantation land said to come with the mill      | reported in **Penajam Paser Utara** |

Two measurable results follow.

The mill and this concession are not neighbours. The nearest edge of the
concession lies 97 km from the mill site at Mangkajang. The concession that does
border the mill is PT Tanjung Redeb Hutani, an IUPHHK-HTI of 185,841 ha in
Berau. That is a different company.

Current KLHK data holds no permit of about 200,000 ha in Penajam Paser Utara.
The seven permits there above 3,000 ha total 151,552 ha. The largest is PT ITCI
Hutani Manunggal at 40,388 ha inside that regency.

The reported figure may be historical, or a total across several companies, or
since reduced. Part of that area now lies inside the IKN site. This file does
not claim the reporting is wrong. It records only that current data does not
reproduce the figure.

Several outlets place PT Kiani Lestari in Berau. The polygon lies wholly in
Kutai Timur, and the SVLK audit names the same five kecamatan there.

## 2.8 What this analysis cannot show

- **VIIRS records heat, not ignition.** It cannot show who lit a fire, or on
  whose instruction. Nothing here attributes an act to any person.
- **Canopy loss is not always illegal.** Hansen records the removal of tree
  cover. On a plantation that includes an ordinary harvest.
- **Fire and loss in the same year is a correlation.** A fire lit after felling
  and a fire that caused the loss look alike from orbit.
- **This is not a finding of illegality.** Since UU Cipta Kerja and P.8/2021,
  IUPHHK permits became PBPH with _multiusaha kehutanan_. That can allow
  planting in a former HA area, although the audit of April 2023 records this
  permit as natural forest only. Burning as a method of clearing is prohibited
  under any permit class, under UU 41/1999 and UU 32/2009 article 69. To decide
  which rules apply here you need the current PBPH document and an enforcement
  finding. A map cannot decide it.
- **Ownership comes from the public record, not from data.** No spatial dataset
  holds beneficial ownership. GFW's `gfw_wood_fiber` has `company` and
  `comp_group` fields, and both are empty on every Indonesian feature. BIG's
  permit layers hold no shareholder field.
- **2026 uses the NRT product.** It is not quality controlled, and its
  geolocation is coarser than SP.
- **The control ring holds other concessions.** It is a relative baseline, not
  untouched forest. Test 1 is the stronger comparison.

## 2.9 Notes on coverage

WALHI ran a second, earlier survey of 231 concessions with hotspots, published
in July 2025. It is not the analysis cited in section 1.9. It does not list PT
Kiani Lestari. That survey covered Sumatera Selatan, Sumatera Barat,
Kalimantan Selatan, Kalimantan Barat, Riau, Aceh, Kalimantan Tengah and Jambi.
Kalimantan Timur lay outside it. As far as the sources consulted here show, no
one has reported the fire measured in section 2.4.

## 2.10 Sources

**Company and permit record**

- [JK Ungkap Sebab Tanah Bob Hasan Bisa Dimiliki Prabowo — CNN Indonesia, 11 Jan 2024](https://www.cnnindonesia.com/ekonomi/20240111090200-92-1047995/jk-ungkap-sebab-tanah-bob-hasan-bisa-dimiliki-prabowo)
- [JK Cerita Tanah Prabowo yang Diusik Anies, Dulu Milik Bob Hasan — CNN Indonesia, 11 Jan 2024](https://www.cnnindonesia.com/ekonomi/20240111064644-92-1047930/jk-cerita-tanah-prabowo-yang-diusik-anies-dulu-milik-bob-hasan)
- [JK: Saya fasilitasi Prabowo untuk beli pabrik kertas di Kalimantan — ANTARA News](https://www.antaranews.com/berita/3909366/jk-saya-fasilitasi-prabowo-untuk-beli-pabrik-kertas-di-kalimantan)
- [Cerita JK jadi Perantara Pembelian Pabrik Kertas Milik Bob Hasan ke Prabowo — Tempo](https://bisnis.tempo.co/read/1819974/cerita-jk-jadi-perantara-pembelian-pabrik-kertas-milik-bob-hasan-ke-prabowo)
- [Lika-Liku Kepemilikan Lahan Ratusan Ribu Hektare PT Kiani dan Prabowo — Katadata](https://katadata.co.id/yuliawati/berita/5e9a55230ae60/lika-liku-kepemilikan-lahan-ratusan-ribu-hektare-pt-kiani-dan-prabowo)
- [Kedok Baru Sang Presiden — The Gecko Project, 14 Oct 2024](https://thegeckoproject.org/id/articles/presidents-new-clothes/)

**Permit status**

- [Resume Hasil Penilikan I, Verifikasi Legalitas Hasil Hutan, PT Kiani Lestari — PT Global Resource Sertifikasi, audit 3–10 Apr 2023](https://global-resource.co.id/wp-content/uploads/2024/11/2023-5.-Resume-Penilikan-I-VLHH-PT-Kiani-Lestari-website.pdf)
- [SK Pencabutan Izin Konsesi Kawasan Hutan, `SK.01/MENLHK/SETJEN/KUM.1/1/2022` — SIEJ](https://siej.or.id/sites/default/files/filefield_paths/SK%20Pencabutan%20Izin%20Konsesi%20Kawasan%20Hutan.pdf)
- [Keputusan Menteri LHK `SK.01/MENLHK/SETJEN/KUM.1/1/2022` — Hukumonline](https://www.hukumonline.com/pusatdata/detail/lt61ea5f1790d41/keputusan-menteri-lingkungan-hidup-dan-kehutanan-nomor-sk01-menlhk-setjen-kum1-1-2022-tahun-2022/legal_bases/)
- [38 Perizinan Berusaha Pemanfaatan Hutan Dicabut Sekaligus — Betahita](https://www.betahita.id/sorot/7009/38-perizinan-berusaha-pemanfaatan-hutan-dicabut-sekaligus)
- [Warga Desa di Kec Batu Ampar Resah dengan Beraktifitas Kembali PT Kiani Lestari — Mitrapol, 11 Apr 2023](https://mitrapol.com/2023/04/11/beberapa-warga-desa-di-kec-batu-ampar-kab-kutim-resah-dengan-beraktifitas-kembali-pt-kiani-lestari/)

**Research and independent monitoring**

- Purnomo, E.P. and others. _Forest and land fires, toxic haze and local politics in Indonesia._ International Forestry Review 21(4): 486–500, 2019. [CIFOR](https://www.cifor.org/library/7425/) · [PDF](https://www.cifor-icraf.org/publications/pdf_files/articles/APurnomo1902.pdf)
- [Karhutla Berulang di Konsesi Korporasi: 1.351 Titik Api — WALHI, 31 Mar 2026](https://www.walhi.or.id/karhutla-berulang-di-konsesi-korporasi-1-351-titik-api-ungkap-kegagalan-penegakan-hukum)
- [Titik Panas Karhutla Terdeteksi di 231 Konsesi Perusahaan — Betahita, Jul 2025](https://betahita.id/news/lipsus/11290/titik-panas-karhutla-terdeteksi-di-231-konsesi-perusahaan.html)
- [Indonesia shows elevated fire hotspot activity in 2026 as super El Niño threat looms — Mongabay, 29 Jul 2026](https://news.mongabay.com/2026/07/indonesia-shows-elevated-fire-hotspot-activity-in-2026-as-super-el-nino-threat-looms/)
- [Karhutla Kalbar 2026 Capai 28 Ribu Hektare, 159 Perusahaan Diberikan Sanksi — aksaraloka.com, 13 Aug 2026](https://aksaraloka.com/2026/08/13/karhutla-kalbar-2026-capai-28-ribu-hektare-kadis-lhk-159-perusahaan-diberikan-sanksi/)
- [Ketika Kebakaran Hutan dan Lahan Menggila di Kalimantan — Mongabay Indonesia, 6 Aug 2026](https://mongabay.co.id/2026/08/06/ketika-kebakaran-hutan-dan-lahan-menggila-di-kalimantan/)
- [2023 Deforestation by the Wood Pulp Industry in Indonesia Surges, Hits Record Highs in Kalimantan — Nusantara Atlas](https://nusantara-atlas.org/2023-deforestation-by-the-wood-pulp-industry-in-indonesia-surges-hits-record-highs-in-kalimantan/)
- [Industrial Wood Pulp Deforestation in Indonesia Slows in 2024 — Nusantara Atlas](https://nusantara-atlas.org/industrial-wood-pulp-deforestation-in-indonesia-slows-in-2024/)
- [Monthly mapping of Indonesia's burned areas — International Journal of Remote Sensing, 2024](https://www.tandfonline.com/doi/full/10.1080/01431161.2024.2421942)
- [Enhancing Fire Monitoring over Peatlands and Non-Peatlands in Indonesia Using VIIRS Data — Fire 7(1):9, 2024](https://doi.org/10.3390/fire7010009)

**Data**

- NASA FIRMS — `firms.modaps.eosdis.nasa.gov/api/area/csv`
- UMD/Hansen canopy loss v1.13 through GFW — `tiles.globalforestwatch.org`
- BIG SatuPeta — `kspservices.big.go.id/satupeta/rest/services/PUBLIK/`
