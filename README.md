# proto-plugins

TOML plugin schemas for [proto](https://moonrepo.dev/proto), a next-generation toolchain manager by moonrepo.

Browse the catalog at **[tomdavidson.github.io/proto](https://tomdavidson.github.io/proto)**.

## Usage

Add a plugin to your `.prototools`:

```shell
proto plugin add <id> "https://tomdavidson.github.io/proto/<id>.toml"
```

Then install:

```shell
proto install <id>
```

See the [proto TOML plugin docs](https://moonrepo.dev/docs/proto/plugins#toml-plugin) for the schema reference.

## Development

Plugins live in `plugins/*.toml`. The CI workflow (`tnd.yml`) does two things on push to `main`:

1. Smoke-tests changed plugins by generating a temporary `.prototools` and running `proto install --all`.
2. Builds a `plugins.jsonld` catalog and deploys it alongside the TOML files and `index.html` to GitHub Pages.

Scripts (run with [Bun](https://bun.sh)):

- `scripts/build-prototools.ts` generates the smoke-test `.prototools.test` file.
- `scripts/build-jsonld.ts` produces the JSON-LD catalog consumed by the web frontend.

## License

See [LICENSE](LICENSE).
