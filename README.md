# Tommy’s Garage

Bike fleet stats by Coach Tommy Random. The Polish dashboard runs offline in your browser.

## Use it

Open a hosted copy or the built `dist/index.html`. Choose **Wybierz plik ze Stravy** and select a Strava ZIP or `activities.csv`. **Wypróbuj demo** opens sample rides. [Get your Strava export](https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export#bulk-export)

**Przegląd** shows distance, moving time, and rides per bike. **Szczegóły** adds charts and searchable ride history. The app also accepts [coach ride exports](RIDE_FORMAT.md).

## Build it

```sh
npm ci
npm test
npm run build
```

The build produces a single shareable `dist/index.html`. For GitHub Pages, select GitHub Actions as the Pages source and run the [Dashboard workflow](.github/workflows/pages.yml).

[MIT License](LICENSE)
