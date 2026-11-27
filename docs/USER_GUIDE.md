# Tommy’s Garage user guide

See distance, riding time, and activity history for each bike using your Strava account export. You can also open the demo to look around before requesting your data.

## Download your Strava archive

1. Sign in on the Strava website in your browser.
2. Open the profile menu in the top right, choose **Settings**, then choose **My Account**. [Open Strava My Account](https://www.strava.com/account)
3. Find **Download your account** and select **Get Started**.
4. On the next page, select **Request download**. Strava sends the download link by email. It may take a few hours.
5. Download the account ZIP from the email and save it on your device. [Strava’s bulk export instructions](https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data#h_8a5eb530f1)

## Open Tommy’s Garage

- **Online.** Open the hosted dashboard in your browser. [Tommy’s Garage](https://michal-fularz.github.io/tommy-garage/)
- **Offline.** Download the Tommy’s Garage ZIP under **Assets**. Unpack it and open `Tommy-Garage.html` in your browser. That single HTML file contains the app. [Latest release](https://github.com/Michal-Fularz/tommy-garage/releases/latest)

Choose **Wybierz plik ze Stravy** and select the Strava ZIP directly. If you already extracted the archive, you can select `activities.csv` instead. Choose **Wypróbuj demo** to try it with sample rides.

## Explore your fleet

- **Przegląd** shows distance, riding time, and ride counts per bike. Click a bike to open its history.
- **Szczegóły** opens annual and monthly charts, seasonality by bike, and searchable ride history. Power and heart rate appear when those fields are available.
- **Zmień dane** loads another file. Rides with no recorded bike appear under **Bez przypisania**.

## How your files are handled

Both versions process your rides in the browser. When you select a Strava ZIP, the app reads the archive’s directory and extracts `activities.csv` and the optional `bikes.csv`. Your archive stays on your device. The hosted dashboard needs a connection to open the app, and the downloaded HTML opens offline. [ZIP import code](../src/imports.js#L184)

The build produces one `index.html` with the app, chart library, styles, and artwork embedded. GitHub Actions publishes that output to GitHub Pages when `main` changes. The offline release packages the same build output as `Tommy-Garage.html`. [Build script](../build.mjs) · [GitHub Pages workflow](../.github/workflows/pages.yml)
