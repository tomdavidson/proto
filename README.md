# proto-plugins

TOML plugin schemas for [proto](https://moonrepo.dev/proto), a next-generation toolchain manager by moonrepo.

## Available Plugins

| Tool | Description | Schema |
|------|-------------|--------|
| [dprint](https://dprint.dev) | Pluggable code formatting platform | `plugins/dprint.toml` |

## Usage

Add the plugin to your `.prototools`:

```toml
dprint = "0.46.2"

[plugins]
dprint = "https://raw.githubusercontent.com/tomdavidson/proto/main/plugins/dprint.toml"
```
