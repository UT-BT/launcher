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
Windows is the only supported target:

```bash
npm run build:win
```

Distribution files will be located in the `dist` directory.

