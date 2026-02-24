# Workflow Rules

Shared workflow rules for this project. Adapted from chillist-docs common rules.

---

## Issue-Driven Development

- GitHub Issues are the single source of truth for all planned work
- Every feature, enhancement, or task must have a corresponding GitHub issue before work begins
- Every bug must be filed as a GitHub issue before fixing
- Do NOT start coding without an issue to reference

## Starting Work

1. If working on a bug and no issue exists yet, create one first:
   `gh issue create --title "<title>" --label "bug" --body "<description>"`
2. Fetch the GitHub issue assigned to this task: `gh issue view <number>`
3. Confirm with user which issue we're working on
4. Assign yourself and add "in progress" label
5. Create a feature branch from up-to-date main: `git checkout main && git pull origin main && git checkout -b <branch>`

## Planning Mode (Mandatory First Step)

- Output a concise plan before writing code
- Identify modules/components affected and design patterns to use
- Flag potential security risks (OWASP, WordPress-specific)
- If less than 90% sure about intent, ask clarifying questions

## Implementation Flow

1. **Structure First:** Break tasks into small functions. Show signatures/interfaces only
2. **Wait for Approval:** Do not implement until reviewed
3. **One by One:** Implement each function individually — never generate large code blocks unless explicitly asked

---

## Code Standards (PHP/WordPress)

- No comments in code (exception: complex "why" logic that is non-obvious)
- No lazy coding: never use `// ... rest of code` or placeholders. Always output the full correct block
- Read the target file's existing imports, types, and indentation style before generating code
- Pin dependency versions exactly in composer.json (no `^` or `~` ranges) to prevent supply chain attacks
- Use PSR-4 namespaces under `WSI\` namespace

## WordPress-Specific Standards

- Every PHP file starts with `defined('ABSPATH') || exit;`
- Sanitize all input: `sanitize_text_field()`, `absint()`, `sanitize_email()`
- Escape all output: `esc_html()`, `esc_attr()`, `esc_url()`
- Nonces on all admin forms: `wp_nonce_field()` / `wp_verify_nonce()`
- Permission callbacks on every REST route
- Prepared SQL: `$wpdb->prepare()` for any direct queries
- REST errors use `WP_Error` objects with proper HTTP status codes
- All options/hooks prefixed with `wsi_`
- All user-facing strings wrapped in `__('text', 'wp-shop-inventory')` for i18n
- Admin pages gated behind `manage_woocommerce` capability

## Dependency Injection

- Use DI pattern: main Plugin class wires dependencies and passes them to controllers/services
- Controllers receive services via constructor
- Tests inject mocks via constructor
- Never use global state or singletons for service access in route handlers

---

## Security (OWASP + WordPress)

- **NEVER** output API keys, passwords, or tokens. Warn immediately if hardcoded secrets are found
- Assume all input is malicious
- Token generated via `wp_generate_password(48, true, true)`, stored as hash
- Bearer tokens must only be sent over HTTPS (warn if HTTP)

## Debugging

- Stop on test or build failures — do not proceed to the next step
- Do not randomly patch. Analyze the stack trace and explain the root cause before fixing

---

## Git Branch Policy

- **NEVER** push directly to `main`
- Always create a feature branch and push to that branch
- Use Pull Requests to merge into main

## Git Workflow

When committing, follow this sequence:

1. Stash current changes
2. Switch to main and pull latest: `git checkout main && git pull origin main`
3. Create a new feature branch with an appropriate name from main
4. Pop the stash to apply changes on the new branch
5. Stage and commit with a clear message
6. If a related GitHub issue exists, include `Closes #XX` in the commit message
7. Push the branch: `git push -u origin <branch-name>`
8. Create a PR immediately after push using `gh pr create`
   - Include `Closes #XX` in the PR body if there is a related issue

## Commit Messages

Follow Conventional Commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Version Bumps

- Bump the `version` in both `composer.json` and the plugin header in `wp-shop-inventory.php` on every commit using semver:
  - `patch` (1.0.X) — bug fixes, small changes, refactors
  - `minor` (1.X.0) — new features, new endpoints
  - `major` (X.0.0) — breaking changes
- Include the version bump in the same commit as the code change

---

## Bug Workflow

1. If a bug fix has no existing GitHub issue, create one before committing:
   `gh issue create --label bug --title "<short description>" --body "<details>"`
   Include: what went wrong, root cause, and what was fixed
2. If an existing issue covers the bug, use that issue number
3. The PR must include `Closes #XX` to auto-close the bug issue on merge

## Updating Documentation

When completing work that changes any of the following, update the corresponding docs:

- **README.md (root)** — Update when: new features are marked done, API endpoints change, stack changes, getting-started steps change, monorepo structure changes, or roadmap items are completed. The root README is the public face on GitHub — keep it accurate.
- **docs/full-project-spec.md** — Update the implementation status table when features are completed or specs change.
- **docs/architecture.md** — Update when system design, component responsibilities, or architectural decisions change.
- **docs/workflow-rules.md** — Update when workflow or coding standards change.
- **docs/testing-strategy.md** — Update when testing patterns or commands change.
- **docs/dev-lessons.md** — Update after every bug fix or non-obvious problem (see below).

## Dev Lessons Log

After fixing any bug, configuration mistake, or non-obvious problem, add an entry to `docs/dev-lessons.md`:

```markdown
### [Category] Short Title
**Date:** YYYY-MM-DD
**Problem:** One sentence describing what went wrong
**Solution:** One sentence describing the fix
**Prevention:** How to avoid this in the future
```

Categories: `Config`, `Deps`, `Logic`, `Types`, `Test`, `Infra`, `Arch`, `WP`, `Security`

---

## API Breaking Change Check

Before committing any change that touches REST routes or response schemas:

1. **Detect breaking changes** — Compare old vs new behavior:
   - Removed or renamed endpoints
   - New required fields in request body
   - Removed fields from response
   - Changed response shape or field types
2. **If breaking** — Keep the old route working alongside the new one:
   - Accept both old and new request formats
   - Create a GitHub issue to remove the deprecated route
3. **If non-breaking** (additive fields, new endpoints) — Proceed normally

---

## Testing

- Every new endpoint must have a matching test file
- Every new endpoint or behavior change must have test coverage **before** finalization
- Tests to write: happy path, validation errors (400), not found (404), auth failures (401)
- "All existing tests pass" is not sufficient — new code requires new tests

### Combine Similar Tests

Use data providers to combine tests that follow the same pattern. Every case must still be covered.

### Avoid Redundant Tests

Do not write a separate test if its assertions are already covered by another test.

---

## Finalization

1. Write tests for any new or changed functionality
2. Run validation from repo root: `make test` (runs unit + integration for all components)
   - Or from `plugin/`: `composer test:run` (unit + integration)
3. Fix any failures automatically
4. Ask for user confirmation
5. Follow the Git Workflow above (commit, push, PR)
