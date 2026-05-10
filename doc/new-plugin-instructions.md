# Creating a New Proto Plugin

When asked to create a proto plugin for a tool, follow every step in order. Do not skip steps. Do not push to `main`. Do not modify `.github/`, `scripts/`, `schema/`, or `web/` — if any of those need changes to support the new plugin, stop and tell the user what is needed before proceeding.

---

## Step 1 — Research the Tool

Given a URL (repo, homepage, or release page), determine:

1. **GitHub Releases URL** — navigate to `https://github.com/<owner>/<repo>/releases` and inspect the assets on the latest release.
2. **Supported platforms** — list only platforms that actually have release assets. Do not add a `[platform.windows]` block if there are no Windows assets. Check Linux, macOS, and Windows separately.
3. **Asset filename pattern** — identify the exact naming convention. Common patterns:
   - `{tool}_{version}_{os}_{arch}.tar.gz` — standard Go/generic
   - `{tool}_{version}_linux_{arch}.tar.gz` with `darwin` for macOS — platform-literal
   - `{tool}-{arch}-unknown-linux-gnu.tar.gz` — Rust target triple
   - `v{version}.tar.gz` from `archive/refs/tags/` — source archive (no binary, library/script tools)
4. **Arch strings used** — check what arch labels appear in asset names (`amd64`, `arm64`, `x86_64`, `aarch64`, `386`, `armv6`, etc.).
5. **Binary location inside archive** — does the binary sit at the archive root, or inside a subdirectory? If inside a subdirectory, note the path.
6. **Checksum file** — does the release include a checksums file? If so, note its name pattern.
7. **Tag format** — do tags follow `v1.2.3` or `1.2.3` or something non-standard like `tool-v1.2.3`?
8. **Tool ID** — the canonical CLI command name, lowercase, hyphen-separated. This becomes the filename and the `.prototools` key.

---

## Step 2 — Write the TOML File

Create `plugins/<id>.toml`. Follow this structure exactly.

### Header comment (required)

```toml
# A TOML plugin for <Tool Name>:
# https://moonrepo.dev/docs/proto/plugins#toml-plugin
# https://github.com/<owner>/<repo>
```

### Top-level fields (required)

```toml
name        = "<Human Readable Name>"
type        = "cli"
description = "<One sentence describing what the tool does.>"
```

### `[resolve]` block (required)

```toml
[resolve]
git-url = "https://github.com/<owner>/<repo>"
```

If tags are not plain `v1.2.3` or `1.2.3`, add a pattern to extract the semver:

```toml
git-tag-pattern = "^v?(\\d+\\.\\d+\\.\\d+)$"
```

### `[platform.<os>]` blocks

Add one block **per OS that actually has release assets**. Never add a platform block if assets do not exist for it.

```toml
[platform.linux]
download-file  = "<asset name with {version} and {arch} placeholders>"
checksum-file  = "<checksum asset name>"   # omit if no checksums published
exe-path       = "<path/to/binary>"        # omit if binary is at archive root with the tool name

[platform.macos]
download-file  = "<asset name>"
checksum-file  = "<checksum asset name>"
exe-path       = "<path/to/binary>"        # omit if same as linux and at root

[platform.windows]
download-file  = "<asset name>.zip"
checksum-file  = "<checksum asset name>"
exe-path       = "<tool>.exe"              # omit if binary is at root named <tool>.exe
```

**Template variables available in `download-file`, `checksum-file`, and `exe-path`:**

| Variable | Value |
|---|---|
| `{version}` | Version without `v` prefix |
| `{arch}` | Mapped value from `[install.arch]` |
| `{os}` | Proto OS name (`linux`, `darwin`, `windows`) |
| `{download_file}` | Resolved `download-file` for current platform |
| `{checksum_file}` | Resolved `checksum-file` for current platform |

Use `archive-prefix` when the archive unpacks into a single top-level directory you want stripped:

```toml
[platform.linux]
download-file  = "tool-{arch}-unknown-linux-gnu.tar.gz"
archive-prefix = "tool-{arch}-unknown-linux-gnu"
exe-path       = "tool"
```

### `[install]` block (required)

```toml
[install]
download-url = "https://github.com/<owner>/<repo>/releases/download/v{version}/{download_file}"
checksum-url = "https://github.com/<owner>/<repo>/releases/download/v{version}/{checksum_file}"  # omit if no checksums

[install.arch]
aarch64 = "<arch string used in asset names>"
x86_64  = "<arch string used in asset names>"
x86     = "<arch string used in asset names>"   # omit if tool does not ship 32-bit
arm     = "<arch string used in asset names>"   # omit if tool does not ship arm32
```

Only include arch entries for architectures the tool actually ships. Cross-reference with the real asset names from Step 1.

### `[detect]` block (optional)

Add only if the tool has a conventional version pin file:

```toml
[detect]
version-files = [".<tool>-version"]
```

---

## Step 3 — Register in `.prototools`

Add the plugin and a pinned version to the root `.prototools`. Use the latest stable release version from the releases page.

```toml
# In [plugins] section:
<id> = "source:plugins/<id>.toml"

# In the top-level version pins:
<id> = "<latest stable version>"
```

Do not add a `[tools]` header — the root `.prototools` uses bare top-level version pins, not a `[tools]` table.

---

## Step 4 — Self-Review Checklist

Before committing, verify:

- [ ] Platform blocks exist **only** for OSes with actual release assets
- [ ] `[install.arch]` values match the exact strings in release asset filenames
- [ ] `exe-path` is set if the binary is not at the archive root or is not named exactly `<id>` (or `<id>.exe` on Windows)
- [ ] `checksum-url` is present if a checksums file is published
- [ ] `git-tag-pattern` is set if tags are not standard `v1.2.3` / `1.2.3`
- [ ] No `[platform.windows]` block if the tool does not publish Windows assets
- [ ] Comment header present
- [ ] `.prototools` updated with both `[plugins]` entry and version pin
- [ ] No changes to `.github/`, `scripts/`, `schema/`, or `web/`

If any of `.github/`, `scripts/`, `schema/`, or `web/` need modification to support this plugin, **stop here and tell the user** what change is needed and why before touching those files.

---

## Step 5 — Branch and PR

1. Create a branch named `plugin/<id>`.
2. Commit only `plugins/<id>.toml` and `.prototools`.
3. Open a pull request targeting `main` with title `feat: add <name> plugin`.
4. Wait for the CI check (`Install changed plugins`) to pass.

The CI workflow (`tnd.yml`) does the following on every PR [cite:54]:
- Validates the TOML against the JSON schema with taplo
- Generates a smoke-test `.prototools.test` containing only the changed plugins
- Runs `proto install -y` in a clean temp directory
- Runs `proto status` to confirm the binary is shimmed

**The plugin is not done until the CI build is green.** If it fails, diagnose from the workflow logs — most failures are an `[install.arch]` mismatch or a wrong `exe-path`.

---

## Reference: Pattern Examples

### Standard Go tool (most common)
`actionlint`, `gitleaks`, `gh` style — assets named `{tool}_{version}_{os}_{arch}.{ext}`.

### Rust target-triple naming
`tera` style — assets named `{tool}-{arch}-unknown-linux-gnu.tar.gz`. Use `archive-prefix` to strip the directory.

### macOS uses different arch labels than Linux
Common: Linux uses `amd64`/`arm64`, macOS uses `x86_64`/`aarch64` or vice versa. If they differ, use per-platform `exe-path` or check whether `{arch}` in the filename resolves consistently from `[install.arch]`.

### No binary (library/script archive)
`bats-assert` style — source archive from `archive/refs/tags/v{version}.tar.gz`. No `exe-path`. Use `archive-prefix` to normalize the extracted directory name.
