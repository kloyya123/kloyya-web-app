/**
 * pnpm install hook.
 *
 * drizzle-orm ships adapters for many drivers and declares every one as an
 * OPTIONAL peer dependency — including Prisma. With pnpm's default
 * `autoInstallPeers: true`, that pulls @prisma/client + prisma into the tree
 * even though we drive Drizzle through postgres-js and never touch Prisma.
 *
 * We strip Prisma from drizzle-orm's peer declarations so it stays out of the
 * lockfile entirely. This is the one place Prisma is even named in the repo,
 * and it exists only to keep Prisma OUT.
 *
 * Second hook: @hookform/resolvers imports `zod/v3` and `zod/v4/core` in its
 * type definitions but declares ONLY react-hook-form as a peer — never zod.
 * In a flat/hoisted node_modules (its standalone default) it reaches zod by
 * directory-walking; under pnpm's strict isolated linking it can't, so tsc
 * resolves `zod/v4/core` to the wrong module and every zodResolver() call
 * fails to typecheck. We add zod as an OPTIONAL peer so pnpm wires the app's
 * own zod into the resolver — matching how it resolved when it was green.
 */
function readPackage(pkg) {
  // Both drizzle-orm and better-auth declare Prisma as an optional peer. Strip
  // it from each so pnpm's autoInstallPeers never drags Prisma back into a tree
  // that runs entirely on Drizzle + postgres-js.
  if (pkg.name === 'drizzle-orm' || pkg.name === 'better-auth') {
    for (const key of ['@prisma/client', 'prisma']) {
      if (pkg.peerDependencies) delete pkg.peerDependencies[key];
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[key];
    }
  }
  if (pkg.name === '@hookform/resolvers') {
    pkg.peerDependencies = { ...pkg.peerDependencies, zod: '*' };
    pkg.peerDependenciesMeta = { ...pkg.peerDependenciesMeta, zod: { optional: true } };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
