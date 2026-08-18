# GitHub Actions setup

GitHub Actions will run repeatable quality checks before changes merge into the tracker or `main`.

## What is still missing

The repository is public, but the CI workflow and required checks are planned for the Verification + Tooling phase. The workflow should run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

## Repository settings

After `.github/workflows/ci.yml` exists:

1. Open **Settings → Branches → Branch protection rules**.
2. Protect `main` and the feature tracker branch used for integration.
3. Require pull requests and the CI workflow to pass before merging.
4. Disable force-pushes on protected branches.

The current workflow does not require service secrets for static checks. Add GitHub Actions secrets only when a workflow needs them, using **Settings → Secrets and variables → Actions**. Never put Supabase service-role, Resend, or cron secrets in workflow YAML.

## Optional deployment secrets

If CI later runs integration tests, add environment-scoped secrets for a disposable Supabase project. Keep production credentials in Vercel/Supabase, not in pull-request workflows from untrusted forks.
