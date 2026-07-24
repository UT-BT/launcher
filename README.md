<img src="https://utbt.net/static/media/logo-light.405bacd6892eb0c6732d.png" width="128" alt="UTBT Icon"/>

# UTBT Launcher
[![stable](https://img.shields.io/github/v/release/UT-BT/launcher?sort=semver&label=stable)](https://github.com/UT-BT/launcher/releases/latest)
[![rc](https://img.shields.io/github/v/release/UT-BT/launcher?include_prereleases&sort=semver&label=rc&color=orange)](https://github.com/UT-BT/launcher/releases)

Gone are the days of finding ISOs, manually downloading and applying patches, and trying to figure out what settings you need to get involved in the BunnyTrack community.

The UTBT Launcher automates this whole process for you and aims to make getting up and running as seamless as possible. 

Our launcher is intended for use by the [UTBT](https://utbt.net) community, but obviously, you're free to use it even if you don't play BT - but it's optimized for what our community runs.

## Features
- Unreal Tournament 1999 downloader/mounter for Windows using Epic Games' legal distribution.
- Patch management allowing for easy upgrade and downgrades within seconds. 
- Discord Authentication to connect your UTBT account. 
- Join UTBT servers directly through the UTBT Launcher's server browser. 
- Customized homepage showing whats happened since you last logged in. 
- User management, map reviews all through a nice UI
- Automated demo uploads for certified runs to the UTBT backend. 
- Set graphics and key binds through the launcher, and the ability to share your configs with the community.

## Coming Soon
- Ability to start your own local UTBT server for testing
- Tools for streamers: start multiple clients, OBS overlays, etc. 

## Getting Started
1. Download and install the latest version of the UTBT Launcher from the releases page. 
2. Login to Discord to get access to the application
3. Configure your existing UT install, or dowload the game through the settings menu. 
4. Patch your game if required

## Requirements
- Windows 10/11, MacOS and Linux support _may_ come in the future. 
- Existing UT installation optional (the launcher can validate and patch it)

## Community
- Website: [UTBT.net](https://utbt.net)
- Discord: [Join the UTBT Discord](https://discord.gg/utbt)
- YouTube: [UTBT on YouTube](https://youtube.com/@UTBTnet)
- Twitch: [UTBT on Twitch](https://twitch.tv/utbt)

## Contributing

Developer setup and build instructions are available in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Web application

The React renderer also runs as a browser application. API endpoints default to
`https://gateway.utbt.net` and `https://api.utbt.net`; local deployments can
override them with `VITE_GATEWAY_BASE_URL` and `VITE_API_BASE_URL`.

- `npm run dev:web` starts the browser development server.
- `npm run build:web` creates the production application in `dist-web`.
- `npm run test:e2e` runs fixture-backed desktop and mobile Playwright/axe checks.
- `npm run test:e2e:live` opts into a public live-API smoke test.
- `npm run quality:web` runs typechecking, linting, unit tests, the production build,
  and the bundle budget.
