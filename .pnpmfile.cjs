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
 */
function readPackage(pkg) {
  if (pkg.name === 'drizzle-orm') {
    for (const key of ['@prisma/client', 'prisma']) {
      if (pkg.peerDependencies) delete pkg.peerDependencies[key];
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[key];
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
