# take it eSee — Development

## Active application

The active application lives in `web/` and is deployed to Vercel.

## Production

- Primary production domain: `takeitesee.com`
- `www.takeitesee.com` may redirect to the primary domain.
- The former standalone Coming Soon page is retired from the active branch.

## Workflow

- `main` is the production branch.
- New work should be developed on feature branches.
- Verify feature-branch previews before promoting changes to `main`.
- After a production deploy, validate the change directly on `takeitesee.com`.

The retired Coming Soon implementation remains recoverable from Git history if ever needed.
