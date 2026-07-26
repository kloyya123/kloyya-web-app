# Why `vercel.json` relaxes the frozen lockfile

`vercel.json` sets:

```json
"installCommand": "pnpm install --no-frozen-lockfile"
```

JSON has no comments and Vercel's schema rejects unknown keys, so the reasoning
lives here.

## The problem

A default (frozen) install aborts on Vercel before fetching a single package:

```
[ERR_PNPM_LOCKFILE_CONFIG_MISMATCH] Cannot proceed with the frozen installation.
The current "pnpmfileChecksum" configuration doesn't match the value found in
the lockfile
```

## What it is not

Three plausible causes were checked and ruled out:

1. **Lockfile drift.** The worktree `.pnpmfile.cjs` hashes to exactly the value
   recorded in `pnpm-lock.yaml`
   (`sha256-ZmLzSv4tWYF2ADSAzPVrqnXOi8kNHxkZ9pKmFm5rmUE=`). The lockfile is current.

2. **Line endings.** `.pnpmfile.cjs` is LF-only in the worktree, there is no
   `.gitattributes`, and `core.autocrlf` is `false`. Normalising CRLF to LF
   produces the same hash, so a Windows/Linux checkout difference is not it.

3. **A pnpm version mismatch.** `package.json#packageManager` declares
   `pnpm@11.11.0` and the local toolchain is exactly that. Setting
   `ENABLE_EXPERIMENTAL_COREPACK=1` made the builder download and run
   `pnpm@11.11.0` — the log confirms it — and the failure was identical.

So the two environments disagree on how the checksum is *derived*, not on the
file being hashed. That derivation is inside the build image and not something
this repo controls.

## What we give up

`--no-frozen-lockfile` lets pnpm recompute the checksum and continue. The
dependency **resolutions still come from the committed lockfile**, and Vercel
runs its supply-chain verification over all 879 entries before install, so the
deployed tree is still the reviewed one.

What is lost is the guarantee that a build **fails** on a genuinely out-of-date
lockfile. A `package.json` change committed without a matching lockfile update
would now install quietly instead of stopping the deploy.

**Mitigation:** keep `pnpm install --frozen-lockfile` in CI. That is where an
out-of-date lockfile should be caught — it is a code-review problem, not a
deploy-time one.

## When to remove this

Retry a default install whenever the builder's pnpm is upgraded. If it succeeds,
delete `vercel.json` and this file.
