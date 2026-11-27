# Tommy’s Garage

Bike fleet statistics by Coach Tommy Random. Open the dashboard in your browser to see how much you ride each bike. The interface is in Polish.

## Use the dashboard

1. [Request a bulk export from Strava](https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export#bulk-export) and download the ZIP from Strava's email.
2. Open Tommy’s Garage and choose **Wybierz plik ze Stravy**. Select the ZIP or the `activities.csv` file from inside it. Use **Wypróbuj demo** to explore with synthetic rides.
3. Start with **Przegląd** for your bike totals. Open **Szczegóły** for annual and monthly charts, seasonality, power and speed, and searchable ride history.

The browser reads your file locally. For ZIPs, the dashboard extracts the activity CSV and the optional bike CSV. The ride summary uses Strava’s recorded equipment and groups rides that have no bike under **Bez przypisania**. Available sensor metrics appear in Details. Activity links open the corresponding Strava or Intervals.icu page.

## Build or host it

With Node.js installed for development, run the following from the repository root.

```sh
npm ci
npm test
npm run build
```

Open `dist/index.html` directly or serve it as a static page. The single HTML file embeds the artwork, styles, and chart and import libraries and works offline. The included GitHub Pages workflow builds and publishes `dist/` when manually run with GitHub Actions selected as the Pages source. [GitHub Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Use a coach export

The dashboard also accepts a `tommy-garage-rides` JSON file. Both upload routes create the same kind of ride records internally, so a coach export can preserve local gear corrections and flags for secondary recordings. See the [ride file format](RIDE_FORMAT.md).

## Next feature

Compare the seasonality of two bikes on the same chart, with a distance and moving time switch.

## License

[MIT](LICENSE). The build embeds the notices and license terms for the included third-party libraries.
