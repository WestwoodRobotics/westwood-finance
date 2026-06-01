# westwood finance

internal finance tracker for westwood robotics. built with sveltekit + google apps script (clasp) as the backend.

## setup

```sh
pnpm install

pnpm dev
```

npm works too

## stack

- **frontend** — sveltekit (static), svelte 5 runes
- **backend** — google apps script (`backend/Code.gs`)
- **data** — google sheets via GAS web app endpoint

## deploy

```sh
pnpm build   # outputs to /build
```

deployed via `.github/workflows/deploy.yml` to github pages in the `gh-pages` branch

to update the backend, edit `backend/Code.gs` and push. automatically syncs with google apps script via clasp(pre-configured) and `.github/workflos/deploy-script.yml`