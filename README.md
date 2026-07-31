# @12ui/codex-design — retired

`@12ui/codex-design` has been retired. It no longer ships or launches the
former local 12ui Codex Design app, plugin, marketplace entry, or `$design`
skill.

## Migrate

Install the supported 12ui design skill instead:

```bash
npx -y @12ui/design skill install
```

Version `0.1.11` is an intentional tombstone release. Every invocation of the
`codex-design` binary exits with a nonzero status and prints the migration
command above so existing automation cannot mistake retirement for success.

The former implementation remains available in this repository's Git history
and in release tags through `codex-design-v0.1.10`.
