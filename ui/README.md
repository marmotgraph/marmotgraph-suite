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

## Embedding in an iframe

Every page of the suite can be embedded in another application:

```html
<iframe src="https://suite.example.org/editor/instances/1234" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"></iframe>
```

The suite detects that it is framed and shows a reduced view: no general navigation, but a link to continue at the same
place in a new tab. Unsaved changes stay in the frame (the link says so).

- `FRAME_ANCESTORS` of the service lists who may embed the suite (the value of the CSP directive `frame-ancestors`, e.g.
  `'self' https://app.example.org`). Without it, only the suite itself may.
- Signing in: the frame first tries to reuse the session of the user at the OIDC provider (the redirect URI
  `/silent-check-sso.html` needs to be allowed). This needs third party cookies unless the host is on the same site. Otherwise,
  the user is asked to sign in in a popup window. This needs the provider to issue a refresh token and not to send
  `Cross-Origin-Opener-Policy` on its login pages. The session in the frame ends with the page being reloaded.

## Copyright

TODO