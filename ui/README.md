# Get started

npm install

## Configure WebStorm for Vite

### 1. Run configuration

- Click the dropdown next to the Run button → Edit Configurations… → + → npm.
- Name it “Vite dev”.
- Set Command to run.
- Set Scripts to `dev` (the script created by Vite).
- Apply & OK.

### 2. Enable automatic reload and debugging

- In the configuration, go to "Browser / Live Edit"
- Set browser to Chrome (Firefox doesn't support debugging)
- define the URL to be http://localhost:5173
- enable automatic JavaScript debugging

## Adjust project settings

### 1. Auto-Save actions

- Go to File -> Settings -> Tools -> Actions on save
- Enable Prettier and everything you think might make sense (optimize imports, reformat code, ESLint, etc.)

### 2. PlayWright Test

- Click the dropdown next to the Run button → Edit Configurations… → + → npm.
- Name it “Playwright test”.
- Set Command to run.
- Set Scripts to `test:e2e` (or if you prefer `test:e2e:ui` if you want to start a small web UI that watches your test
  files)
- Apply & OK.

## Copyright

TODO