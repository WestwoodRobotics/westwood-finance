# westwood finance

internal finance tracker for westwood robotics. built with sveltekit + google apps script (clasp) as the backend.

## setup

```sh
pnpm install

pnpm dev
```

(npm works too)

## stack

- **frontend** — sveltekit (static), svelte 5
- **backend** — google apps script (`backend/Code.gs`)
- **data** — google sheets via apps script web app endpoint

## deploy

deployed via `.github/workflows/deploy.yml` action to gh pages, viewable in Deployments

to update the backend, edit `backend/Code.gs` and push. automatically syncs with google apps script via clasp(pre-configured) and `.github/workflos/deploy-script.yml`
