# Dependency debt

Snapshot: 2026-07-22. This is intentionally report-only; no existing runtime
dependency was upgraded or removed as part of the web conversion review.

## Launcher

`npm audit --omit=dev` reports one high-severity advisory in `js-yaml`
(GHSA-52cp-r559-cp3m). npm reports that `npm audit fix` can resolve it. A
separate dependency-upgrade change should verify Electron packaging and YAML
configuration behavior before accepting the lockfile changes.

The full install audit currently also reports issues in development/build
dependencies. Treat those as a dedicated maintenance change so toolchain
upgrades can be tested independently from application behavior.

## DataService

`python -m pip check` reports that `wheel 0.47.0` requires
`packaging>=24.0`, while the environment contains `packaging 21.0`. Align
the environment/bootstrap constraints in a separate dependency update and
rerun the full backend suite.
