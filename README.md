# UTBT Launcher
## Prerequisites
- Node.js (v20 or higher)
- npm, yarn, pnpm, or bun

## Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/ut-bt/launcher.git
cd launcher

npm install
```

## Development
Starting the dev server:

```bash
# Can use any package manager (npm, yarn, pnpm, bun)
npm run dev
```

This will start the Electron app with hot-reload enabled.

## Building for Production
Build the application for your platform:

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# Unpacked for all platforms
npm run build:unpack
```

Distribution files will be located in the `dist` directory.