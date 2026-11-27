# Tommy’s Garage ride file

A UTF-8 JSON file with `format` set to `tommy-garage-rides`, `version` set to `1`, and a `rides` array. Units are meters, seconds, watts, and beats per minute.

```json
{
  "format": "tommy-garage-rides",
  "version": 1,
  "rides": [
    {
      "id": "demo-1",
      "date": "2025-06-10",
      "name": "Morning loop",
      "bike": "Demo gravel bike",
      "distance_m": 28000,
      "moving_seconds": 4200,
      "elevation_m": 240,
      "watts": 145,
      "normalized_watts": 161,
      "heart_rate": 125,
      "url": "",
      "secondary": false,
      "dual_role": null,
      "power_meter": null
    }
  ]
}
```

Use local calendar dates and a stable unique string `id` for each ride. Rides with no assigned equipment can use `null` for `bike`. Optional metrics can use `null` or be omitted. `secondary: true` retains a recording in ride history and excludes it from fleet totals and records for individual bikes.
