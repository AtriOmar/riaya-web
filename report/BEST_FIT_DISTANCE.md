# Finding the nearest doctor: straight-line distance vs. road distance

## What problem we are solving

When a patient asks for a doctor, the system must pick the best one. "Best" means close to the patient and available soon. This is the "best fit" search. It is used by the phone assistant and by the admin finder.

To decide what is close, we compared two ways to measure distance.

## The two approaches

### 1. Straight-line distance (what we had first)

We measure the distance "as the crow flies" between the patient and each doctor's cabinet, using the Haversine formula.

- Free and instant. It runs inside our own server, with no network call.
- Always works, even if an outside service is down.
- It ignores roads. A doctor across a lake, a river or a railway can look close but be far to reach.

### 2. Road distance (what we added)

We take the best few doctors from step 1 and ask a map service (Geoapify Route Matrix) for the real driving distance to each one. Then we sort them again by road distance.

- More realistic, because it follows real streets.
- Costs a little: one call per search, about 8 credits on the provider's plan.
- Adds a short wait, and depends on an outside service.

We keep both. Step 1 always runs. Step 2 only improves the order of the top 8. If the map service fails or is slow (3 seconds), we simply keep the step 1 order. Nothing breaks.

## Other rules in the search

- **50 km limit.** Doctors farther than 50 km are left out, so a patient in Tunis is not offered a doctor in Sfax.
- **Fallback.** If no doctor inside 50 km has a free slot, we show the 3 nearest doctors beyond 50 km and mark them as far away. The assistant tells the patient honestly. Before this change the answer was empty.
- **Score.** Each doctor gets `distance in km + waiting time in minutes / 10`. So 10 minutes of waiting counts like 1 km. Lowest score wins.
- **Kilometres only.** In Tunisia people talk about distance in km, not driving time. The assistant only says km. Drive time is never spoken or shown to the patient.

## How we tested

We compared the two methods on real data from our database.

- 4 specialities with the most doctors.
- All 24 cities, with the patient placed at the city centre.
- For each pair, we took the 8 closest doctors by straight line, then asked for their road distance.
- 78 comparisons. No call failed.

We looked at one question: does the best doctor change when we use road distance?

## Results

| Measure | Result |
|---|---|
| Best doctor changes (road km) | 24 of 78 (31%) |
| Best doctor changes (drive time) | 19 of 78 (24%) |
| Time saved when it changes | median 0.8 min, max 4.1 min |
| Searches saving 5 minutes or more | 0 |
| Road distance ÷ straight distance, typical case | 1.01 |
| Road distance ÷ straight distance, worst 10% | 1.9 or more |
| Road distance ÷ straight distance, worst case | 3.27 |

Example, in Tunis: the nearest doctor in a straight line was 1.3 km away, but the road to them was 5.8 km. Another doctor was 2.3 km away in a straight line and also 2.3 km by road. Road distance picks the second one.

## What this means

- Road distance does change the answer in about one search out of four.
- The gain is small. The extra trip avoided is usually a minute or two, and never more than about 4 minutes in our test.
- In most searches the two methods agree, because doctors and patients are in the same part of a city.

## Comparison

| | Straight line | Road distance (top 8) |
|---|---|---|
| Accuracy | Good in a city, weak with obstacles | Better, follows real roads |
| Speed | Instant | Adds a short wait |
| Cost | Free | About 8 credits per search |
| Depends on outside service | No | Yes, with safe fallback |
| Best for | First filter and backup | Final ordering of the top few |

## Our conclusion

We keep both, in two steps. Straight line is the right first filter. Road distance is a light polish on the final order.

We would not say road distance is a big improvement for ranking. Its main benefit is that the assistant can quote a real road distance to the patient instead of an air distance.

## Limits of this test

- It used distance only. It did not include appointment times, which also change the ranking in real use.
- The patient was placed at the city centre. A real address would give slightly different numbers.
- The data comes from our local database, which may contain test doctors.
- Only the 8 nearest doctors by straight line were checked. A doctor outside that group could not be found.

## Possible next steps

- Re-rank only the top 4 instead of 8 to halve the cost. Most changes involve the first few doctors, but we have not tested this.
- Repeat the test with real appointment times.
- Keep a log of both rankings in production for a few weeks, then decide if road distance is worth its cost.
