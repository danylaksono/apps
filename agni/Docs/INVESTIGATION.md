# INVESTIGATION.md — Agni

Case studies built with Agni's own data sources. Each one states what the data
shows, what the public record shows, and what neither establishes. Nothing here
is an allegation; it is a record of measurements and citations.

---

# 1. PT Kiani Lestari — fire and land clearing in Kutai Timur

Analysis run 2026-08-21. All spatial work uses the sources already wired into
this app: NASA FIRMS, UMD/Hansen via GFW, and KLHK permit polygons via BIG
SatuPeta.

## 1.1 Why this concession

Public reporting in 2024 identified PT Kiani Lestari as part of the forestry
group acquired by Prabowo Subianto in 2004. That corporate claim is documented
in the sources below and is **not** something satellite data can confirm or
refute. What satellite data can do is measure what has happened on the ground
inside the permit boundary — which is what section 1.4 does.

## 1.2 The permit record

| field | value | source |
| --- | --- | --- |
| Permit | IUPHHK-HA (natural forest, **not** HTI) | BIG layer `IUPHHKHTI`/`IUPHHKHA`; SVLK audit |
| Decree | `SK.434/Menhut-II/2012`, 9 Aug 2012, 45-year term | BIG `no_sk`/`tgl_sk`; SVLK audit |
| Area | 134,950 ha (decree) / 135,061 ha (measured) | BIG `lssk`; equal-area measurement |
| Location | Muara Wahau, Telen, Muara Bengkal, Muara Ancalong, Batu Ampar — **Kutai Timur** | SVLK audit; polygon is 100% inside Kutai Timur |
| Renumbered | `SK.776/MENLHK/SETJEN/HPL.0/9/2021` — nomenclature to PBPH | SVLK audit |
| Work plan | RKUPH 2022–2031, `SK.7910/MenLHK-PHPL/UHP/HPL.1/12/2021` | SVLK audit |

The measured polygon area matches the decree area to **0.08%**, and GFW's
independent copy of the same MoEF polygon returns 135,069.00 ha. The boundary is
sound enough to compute against.

**Permit class matters for section 1.4.** The 2023 SVLK audit records explicitly
that the company holds *"izin pemanfaatan hutan alam dan bukan hutan tanaman
industri"* — natural-forest utilisation, not industrial timber plantation — and
marks the plantation verifier *Tidak diterapkan (Not Applicable)* for that
reason. The licence model is selective logging, not clear-and-replant.

## 1.3 A contradiction in the public record

Two official records disagree, and this document does not resolve which is
legally operative:

- **5 Jan 2022** — `SK.01/MENLHK/SETJEN/KUM.1/1/2022` revokes hundreds of forest
  concessions. PT Kiani Lestari is listed, at 134,950 ha in Kaltim.
- **Jan 2022 / Feb 2023** — the company self-approves its annual cutting plans:
  RKTPH 2022 via Director decision `05/SK/KL-JKT I/I/2022`, RKTPH 2023 via
  SICAKAP and decision `07/SK/KL-JKT I/II/2023`, both recorded as *self
  approval* in the audit.
- **Apr 2022 – Mar 2023** — timber production is logged, PSDH of
  Rp 168,532,420 and DR of USD 34,274.66 paid, plus arrears settled in Feb 2023.
- **3–10 Apr 2023** — an accredited SVLK body audits the company and passes it
  (*LULUS*, all verifiers *Memenuhi*), issuing a 3-year legality certificate.
- **11 Apr 2023** — local reporting describes villagers in Batu Ampar unsettled
  by PT Kiani Lestari resuming logging after ~25 years dormant, noting the
  revocation decree and that work proceeds via a subcontractor.

The BIG permit layer this app queries still serves the 2012 decree with no
status field, so a revocation is not visible in the spatial data at all. That is
a limitation of the layer, recorded here so nobody reads the polygon as proof of
a valid permit.

## 1.4 What the satellite record shows

Five independent tests. Method in §1.6.

### Test 1 — 38× the fire density of its own permit class

Kiani's seven IUPHHK-HA neighbours share its licence type and its landscape.

| concession (IUPHHK-HA) | ha | fires/100k ha | 2023–26 | loss 01–25 | loss 23–25 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **PT KIANI LESTARI** | 136,261 | **2,547** | **1,228** | **43.1%** | **17.8%** |
| PT Segara Indochem | 61,089 | 226 | 139 | 8.2% | 1.4% |
| PT Panambangan | 44,057 | 125 | 16 | 27.7% | 19.5% |
| PT Narkata Rimba | 65,693 | 75 | 37 | 3.6% | 0.5% |
| PT Oceanis Timber Product | 66,787 | 21 | 9 | 2.2% | 0.3% |
| PT Intertropic Aditama | 45,301 | 18 | 15 | 4.1% | 0.8% |
| PT Gunung Gajah Abadi | 73,637 | 12 | 11 | 4.5% | 1.0% |
| PT Kedung Madu Tropical Wood | 64,864 | 9 | 2 | 4.9% | 0.5% |
| **all seven combined** | 421,427 | **66** | **33** | **7.0%** | **2.7%** |

- fire density, all seasons: **2,547 vs 66 per 100k ha — 38×**
- fire density 2023–26: **1,228 vs 33 — 37×**
- canopy loss 2001–2025: **43.1% vs 7.0%** of area

Across all 23 concessions of both classes in the analysis box, Kiani has the
**highest 2023–26 fire density of any of them** — higher than every pulpwood
(HTI) plantation, which are the operations entitled to clear and replant.

### Test 2 — the fire stops at the permit boundary

| band | area ha | detections | /100k ha | 2023–26 /100k ha |
| --- | ---: | ---: | ---: | ---: |
| inside, core >3 km | 31,962 | 858 | 2,684 | 1,386 |
| inside, 1–3 km | 61,567 | 1,566 | 2,544 | 1,278 |
| inside, 0–1 km | 41,532 | 1,046 | 2,519 | 1,067 |
| outside, 0–1 km | 43,474 | 598 | 1,376 | 488 |
| outside, 1–3 km | 78,324 | 662 | 845 | 267 |
| outside, 3–6 km | 98,258 | 861 | 876 | 186 |

Flat across the whole interior, then a step at the boundary line: **2,519 →
1,376 → 845**. For 2023–26 the step is 4× across the line and 7× against the
3–6 km ring.

### Test 3 — fires sit on that year's fresh clearing

Share of detections whose ~400 m neighbourhood is dominated (≥25%) by canopy
loss dated to the **same calendar year**:

| season | inside concession | control ring |
| --- | ---: | ---: |
| 2013 | 21% | 22% |
| 2015 | 35% | 13% |
| 2019 | 24% | 15% |
| 2022 | 21% | 5% |
| **2023** | **55%** | 35% |
| **2024** | **62%** | 35% |
| **2025** | **57%** | 47% |
| 2013–2025 | **41%** | 20% |

Inverted — of the area cleared each year, how much burned that same year:
**65% (2015), 52% (2023), 33% (2024), 35% (2025)**; 31% across 2013–2025
(16,190 ha of 51,664 ha).

### Test 4 — burning arrives in bursts

3,470 detections on 659 distinct days inside the concession. **94% fall on days
carrying multiple simultaneous fires; 49% on days with ten or more.** Largest
days: 2026-08-19 (66), 2024-09-13 (58), 2015-10-24 (47), 2026-08-06 (43).

### Test 5 — no overlapping permit

Intersected against every IUPHHK-HA and IUPHHK-HTI polygon in Kalimantan Timur:
**zero overlap**. Six HTI permits share an edge; none share area. The clearing
inside this boundary cannot be attributed to another permit holder.

### Canopy loss trajectory

| period | loss ha | period | loss ha |
| --- | ---: | --- | ---: |
| 2001–2010 | 4,442 | 2018 | 2,351 |
| 2011 | 1,424 | 2019 | 1,846 |
| 2012 | 1,195 | 2020 | 1,906 |
| 2013 | 1,096 | 2021 | 1,616 |
| 2014 | 1,899 | 2022 | 1,987 |
| 2015 | 3,192 | **2023** | **7,165** |
| **2016** | **9,277** | **2024** | **8,586** |
| 2017 | 2,253 | **2025** | **8,491** |

**58,723 ha — 43.1% of the concession — has lost tree cover since 2001.** Two
regimes: a fire-driven El Niño spike in 2015–16, and a sustained clearing
programme from 2023 at 7,000–8,600 ha/yr. The last three years are 41% of all
loss since 2001.

### Still active

VIIRS S-NPP NRT retrieved 2026-08-21 — **160 detections inside the concession
between 16 and 21 August, 1,006 MW cumulative FRP, 18 on the retrieval date**
(27 / 4 / 29 / 66 / 16 / 18 by day). 2026-08-19 is the
largest single burning day inside this boundary in the 14-year record. The 2026
season stands at 355 detections by mid-August, ~5× the surrounding landscape,
with the dry season unfinished.

## 1.5 Timeline

Stated as a sequence of dated records, not as causation:

| date | event | source |
| --- | --- | --- |
| 2012-08-09 | IUPHHK-HA granted, 134,950 ha, 45 years | decree / BIG |
| 2013–2022 | canopy loss averages ~1,900 ha/yr; fire density near the landscape rate until 2017 | this analysis |
| 2021-09-09 | permit renumbered to PBPH nomenclature | SVLK audit |
| 2021-12 | RKUPH 2022–2031 approved | SVLK audit |
| 2022-01-05 | permit listed as revoked in `SK.01/2022` | decree |
| 2022-01 / 2023-02 | RKT 2022 and 2023 self-approved by company director | SVLK audit |
| 2023-04 | SVLK audit passes; local reports of logging resuming in Batu Ampar | audit / Mitrapol |
| 2023–2025 | clearing jumps to 7,165 / 8,586 / 8,491 ha per year | this analysis |
| 2023–2026 | fire density reaches 37× the other HA concessions | this analysis |
| 2026-08-19 | largest single burning day on record inside the boundary | this analysis |

## 1.6 Method

- **FIRMS VIIRS S-NPP** — SP archive 2013-01 → 2026-04-30, NRT 2026-05 →
  2026-08-21. 518 five-day windows over `116.20,0.20,117.80,1.60`; 33,769 unique
  detections; Jun 1 – Nov 30 seasons (94% of all detections in this area).
- **UMD/Hansen tree cover loss v1.13** (`tcd_30`) decoded from GFW's encoded PNG
  tiles at z12 (~19 m/px) — blue channel is loss year, exactly as
  `src/lib/gfwRaster.ts` decodes it for the map.
- **Permit polygons** from BIG SatuPeta `PERIZINAN_DAN_PERTANAHAN` layers 1
  (`IUPHHKHA`) and 2 (`IUPHHKHTI`), `maxAllowableOffset=0.0005`.
- **Forest estate** from BIG `KEHUTANAN` layer 0; the concession is 72.1% HP,
  27.2% HPT, 0.8% outside the gazetted estate.
- Areas in an azimuthal equal-area projection centred on 0.9 N, 117.0 E.
- Baseline: the 22 other IUPHHK concessions ≥60% inside the analysis box
  (23 including the target: 8 IUPHHK-HA, 15 IUPHHK-HTI).

Every table above is printed by the scripts in [`Docs/scripts/`](scripts/) —
see [`scripts/README.md`](scripts/README.md):

```sh
cd Docs/scripts
python fetch_data.py all --cache .cache --bbox 116.20,0.20,117.80,1.60
python analyze_concession.py --cache .cache --name "KIANI LESTARI" \
    --ring-bbox 116.60,0.45,117.45,1.32 --peer-bbox 116.20,0.20,117.80,1.60
```

## 1.7 Naming: three different things the reporting merges

This trips up almost every published account, and the permit data separates them
cleanly:

| entity | what it is | where |
| --- | --- | --- |
| PT Kiani Kertas → **PT Kertas Nusantara** | the pulp mill, 525,000 t/yr | Mangkajang, **Berau** |
| **PT Kiani Lestari** | IUPHHK-HA, 134,950 ha (this analysis) | **Kutai Timur**, 97 km from the mill |
| the ~200,000 ha HTI in JK's account | plantation land said to come with the mill | reported as **Penajam Paser Utara / Paser** |

Two measurable consequences:

1. **The mill and the Kiani Lestari concession are not adjacent.** Straight-line
   distance from the concession's nearest edge to the Mangkajang mill site is
   **97 km**. The concession that does border the mill is PT Tanjung Redeb
   Hutani (IUPHHK-HTI, 185,841 ha in Berau) — a different company.
2. **No single ~200,000 ha permit exists in Penajam Paser Utara in current KLHK
   data.** All seven PPU permits above 3,000 ha total 151,552 ha, the largest
   being PT ITCI Hutani Manunggal at 40,388 ha in-kabupaten. The reported figure
   may be historical, an aggregate across companies, or since reduced — part of
   that area is now inside the IKN footprint. It is not matched by a current
   permit polygon, and this document does not claim the reporting is wrong,
   only that the current data does not reproduce it.

Several outlets also place PT Kiani Lestari in Berau. The polygon is **100% in
Kutai Timur**, and the SVLK audit gives the same five kecamatan there.

## 1.8 What this does not establish

- **VIIRS detects heat, not ignition.** It cannot identify who lit a fire, or on
  whose instruction. Nothing here attributes an act to any person.
- **Hansen "tree cover loss" is canopy removal**, not necessarily illegal
  deforestation; on a plantation it includes ordinary harvest.
- **Coincidence of fire and same-year clearing is correlation.** Fire lit after
  felling and fire that caused the loss are indistinguishable from orbit.
- **No finding of illegality.** Since UU Cipta Kerja and P.8/2021, IUPHHK
  permits became PBPH with *multiusaha kehutanan*, which can allow planting in a
  former HA area — though the April 2023 audit records this permit as
  natural-forest only. Burning as a clearing method is separately prohibited
  regardless of permit class (UU 41/1999; UU 32/2009 art. 69). Which rules bind
  here needs the current PBPH document and an enforcement finding, not a map.
- **Ownership is from the public record, not from data.** No spatial dataset
  carries beneficial ownership. GFW's `gfw_wood_fiber` has `company` and
  `comp_group` fields and both are null on every Indonesian feature; BIG's
  permit layers carry no shareholder field at all.
- **2026 figures use the NRT product** — not quality-controlled, coarser
  geolocation than SP.
- **The control ring contains other concessions**, so it is a relative baseline.
  Test 1 (same permit class) is the stronger comparison.

## 1.9 Note on prior coverage

PT Kiani Lestari does not appear in Walhi's July 2025 survey of 231 concessions
carrying hotspots, which covered Sumatera Selatan, Sumatera Barat, Kalimantan
Selatan, Kalimantan Barat, Riau, Aceh, Kalimantan Tengah and Jambi — Kalimantan
Timur was outside its scope. As far as the sources consulted here show, the fire
concentration measured in §1.4 has not previously been reported.

## 1.10 Sources

**Corporate and permit record**

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

**Context**

- [Titik Panas Karhutla Terdeteksi di 231 Konsesi Perusahaan — Betahita, Jul 2025](https://betahita.id/news/lipsus/11290/titik-panas-karhutla-terdeteksi-di-231-konsesi-perusahaan.html)
- [Menanti Keseriusan Tangani Kebakaran Hutan dan Lahan di Konsesi — Mongabay, 7 Aug 2025](https://mongabay.co.id/2025/08/07/menanti-keseriusan-tangani-kebakaran-hutan-dan-lahan-di-konsesi/)

**Data**

- NASA FIRMS — `firms.modaps.eosdis.nasa.gov/api/area/csv`
- UMD/Hansen tree cover loss v1.13 via GFW — `tiles.globalforestwatch.org`
- BIG SatuPeta — `kspservices.big.go.id/satupeta/rest/services/PUBLIK/`
