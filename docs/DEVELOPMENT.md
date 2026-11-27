# Tommy’s Garage developer guide

Tommy’s Garage is a browser app written in JavaScript. It reads ride files, calculates fleet statistics, and draws charts in the browser. The public app can run on GitHub Pages or from a single HTML file on disk.

## Run it locally

Use Node.js 22 to match GitHub Actions. From the repository root, install the locked dependencies, run the unit tests, and build the app.

```sh
npm ci
npm test
npm run build
```

Open `dist/index.html` in a browser and choose **Wypróbuj demo** to check changes with sample rides. The demo is defined in [`src/demo.js`](../src/demo.js).

## Where to make changes

| Task | Files and tools |
| --- | --- |
| Import Strava ZIP or CSV and coach JSON | [`src/imports.js`](../src/imports.js) uses zip.js to read the activity and bike files from the archive, and Papa Parse to parse CSV. The JSON input follows the [ride file format](../RIDE_FORMAT.md). |
| Change totals, filters for included rides, or seasonal statistics | [`src/fleet.js`](../src/fleet.js) aggregates normalized ride records. Both import paths use this calculation. |
| Change the import screen or simple overview | [`src/index.html`](../src/index.html), [`src/app.js`](../src/app.js), and [`src/styles.css`](../src/styles.css) contain the markup, browser behavior, and styling. |
| Change detailed charts, tables, or ride search | [`src/details.js`](../src/details.js) and [`src/details.html`](../src/details.html) render the detailed view, with Apache ECharts for charts. |
| Change the single-file build | [`build.mjs`](../build.mjs) bundles JavaScript with esbuild, compiles Tailwind CSS, and embeds the chart library, artwork, styles, and license notices in `dist/index.html`. |

Use synthetic import fixtures in tests. Personal exports belong on your device. The coach’s optional JSON exporter lives in the coach repository and is a separate way to supply the dashboard with ride records.

## Check the offline package

```sh
npm run package
npx playwright install --only-shell chromium
npm run test:browser
```

The packaging command builds `dist/index.html` and writes `artifacts/Tommy-Garage-v<version>.zip` using the version in `package.json`. The ZIP contains one file named `Tommy-Garage.html`. The browser check extracts it, confirms it matches the build, and tests demo rides, a synthetic Strava ZIP import, charts, and ride history in Chromium with networking disabled. [Packaging script](../scripts/package.mjs) · [Browser check](../checks/offline.mjs)

## Continuous integration and deployment

The Dashboard workflow runs the unit tests, packages the app, and checks the unpacked ZIP in Chromium on pull requests and pushes to `main`. Successful runs provide the ZIP as an Actions artifact. A successful build from `main` also deploys `dist/` to GitHub Pages. [Dashboard workflow](../.github/workflows/pages.yml)

For a versioned GitHub release, update the npm version with `npm version <version> --no-git-tag-version` and include `package.json` and `package-lock.json` in the change. Once it merges, attach the matching `main` build’s ZIP to a GitHub Release tagged `v<version>` at that commit. The release link is suitable for sharing with users. [GitHub Releases](https://github.com/Michal-Fularz/tommy-garage/releases)
