# Deployment documentation

Besides the documentation of the Suite and of the core, every deployment can publish documentation of its own - for
example its curation guidelines, conventions or whom to contact. It is shown in the "Deployment" tab, at `/docs/custom/`.

The documentation of the model (types, properties and spaces) doesn't need to be written: it is generated from the
definitions of the core.

## Writing it

The documentation is a [Zensical](https://zensical.org/) site, like the documentation of the Suite and of the core.
Start from the template in the repository of the Suite (`custom-docs-template`):

```bash
cp -r custom-docs-template my-deployment-docs
cd my-deployment-docs
pip install -r requirements.txt
zensical serve   # preview while writing
zensical build   # writes the site to site/
```

The pages can link to the other parts of the documentation relatively - the Suite at `../index.html`, the core at
`../core/index.html`. Since the site is served below the Suite, these links only resolve there, not in the preview.

## Publishing it

The Suite serves the built site (the content of `site/`) from the directory configured by `DOCS_CUSTOM_DIR`, e.g. as a
volume:

```yaml
services:
  suite:
    environment:
      DOCS_CUSTOM_DIR: /docs-custom
    volumes:
      - ./my-deployment-docs/site:/docs-custom:ro
```

The pages are read on every request, so a new build shows up without restarting the Suite. Without `DOCS_CUSTOM_DIR`,
the "Deployment" tab is hidden.
