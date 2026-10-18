### TikSupport

No-login student ticket submission and status tracking for Helpdesk.

### Installation

TikSupport adds a public student support page to a Frappe site with Helpdesk installed. Students can submit requests with an email address and look up a ticket's subject and status with its number and the same email. It does not give Guest users access to Helpdesk ticket records.

The app source lives at `workspace/frappe-bench/apps/tiksupport`, as a sibling of `apps/helpdesk`, so Helpdesk app updates do not overwrite it. Keep and deploy this app's source independently from Helpdesk. TikSupport's `tiksupport_global.bundle.scss` is the shared SCSS entry for website pages and the Helpdesk SPA; it imports partials for headers, headings, links, and the Helpdesk startup loader. TikSupport also inserts the loader into the Helpdesk SPA's `#app` mount element and injects its sidebar stylesheet; Vue replaces the loader when it mounts. When Kustomize is installed, TikSupport also injects a logo-switching script that reads the configured logo and site icon from Kustomize.

### Local Docker Setup

This repository's Docker bench mounts `workspace/frappe-bench/apps`. Add `tiksupport` to `FRAPPE_APPS` in `.env` so bench bootstrap retains the app and includes it when preparing a new site. Ensure the app source is present at `workspace/frappe-bench/apps/tiksupport` before bootstrapping. It is already installed in the current development bench.

Open `/tiksupport` on the site, for example `http://localhost:8000/tiksupport`.

### Installing in Another Bench

Place this repository at `apps/tiksupport`, install its Python package, then install the app on the site:

```bash
cd $PATH_TO_YOUR_BENCH
./env/bin/pip install -e apps/tiksupport
bench install-app tiksupport
```

TikSupport declares Helpdesk as a required app and cannot be installed without it.

### Contributing

Code is formatted with Ruff. Run the app tests on a bench site that has Helpdesk installed:

```bash
bench --site support run-tests --module tiksupport.tests.test_api
```

### License

mit
