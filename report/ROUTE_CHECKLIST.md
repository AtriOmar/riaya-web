# Which routing service is closer to reality?

We asked two services (Geoapify and Mapbox) for the road distance from a city centre to 499 doctors. They agree on most short routes, but differ on some long ones. We do not know which is right, because neither is a real measurement.

This file is a short checklist. Open each Google Maps link, read the distance Google shows for the **fastest route**, and write it in the last column. Then we can see which service is closer to Google.

Notes:
- The start point is the city centre, not a real address.
- Google may show two or three routes. Use the first one (the recommended one).
- All numbers are in km.

| # | City | Doctor | Geoapify | Mapbox | Google (fill in) | Link |
|---|---|---|---|---|---|---|
| 1 | Nabeul | 304 | 48.80 | 63.43 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.46,10.725&destination=36.730267,10.341217&travelmode=driving) |
| 2 | Nabeul | 1177 | 49.08 | 63.41 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.46,10.725&destination=36.73198,10.340414&travelmode=driving) |
| 3 | Nabeul | 1889 | 49.64 | 62.89 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.46,10.725&destination=36.7353862,10.3310511&travelmode=driving) |
| 4 | Zaghouan | 1889 | 49.14 | 60.63 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.405,10.145&destination=36.7353862,10.3310511&travelmode=driving) |
| 5 | Beja | 1593 | 29.79 | 40.88 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.73,9.18&destination=36.6010155,8.9593636&travelmode=driving) |
| 6 | Zaghouan | 304 | 50.08 | 61.16 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.405,10.145&destination=36.730267,10.341217&travelmode=driving) |
| 7 | Tunis | 770 | 2.83 | 5.72 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.82,10.195&destination=36.818143,10.174147&travelmode=driving) |
| 8 | Ben Arous | 2203 | 9.84 | 12.48 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.745,10.235&destination=36.787188,10.172264&travelmode=driving) |
| 9 | Mahdia | 372 | 37.43 | 34.99 |  | [open](https://www.google.com/maps/dir/?api=1&origin=35.505,11.055&destination=35.689439,10.84479&travelmode=driving) |
| 10 | Ben Arous | 1729 | 9.84 | 12.14 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.745,10.235&destination=36.787868,10.172634&travelmode=driving) |
| 11 | Jendouba | 1728 | 48.28 | 46.04 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.5,8.78&destination=36.188122,8.726075&travelmode=driving) |
| 12 | Jendouba | 969 | 42.63 | 42.55 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.5,8.78&destination=36.7783001,8.6846786&travelmode=driving) |
| 13 | Jendouba | 1335 | 48.35 | 48.27 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.5,8.78&destination=36.180191,8.719701&travelmode=driving) |
| 14 | Jendouba | 224 | 49.52 | 49.44 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.5,8.78&destination=36.175,8.71&travelmode=driving) |
| 15 | Jendouba | 1178 | 49.46 | 49.38 |  | [open](https://www.google.com/maps/dir/?api=1&origin=36.5,8.78&destination=36.18084,8.711458&travelmode=driving) |

Rows 1–6 are the biggest disagreements, 7–11 are medium, and 12–15 are cases where the two services agree. If Google matches the agreeing pair, that tells us they are both reliable on short routes.

The full list of all 499 routes is in `route-comparison.csv`.
