# Dev Lessons

A log of bugs fixed and problems solved. Updated after fixing bugs or solving non-obvious problems.

---

<!-- Add new entries at the top -->

### [Infra] macOS TMPDIR vs /tmp
**Date:** 2026-02-24
**Problem:** Install script used `$TMPDIR` which on macOS resolves to `/var/folders/...`, but the PHPUnit bootstrap defaults to `/tmp/` — files not found
**Solution:** Hardcode `/tmp` in the install script instead of relying on `$TMPDIR`
**Prevention:** Never use `$TMPDIR` for paths that must be consistent across scripts; use a fixed directory

### [Test] WP test suite release tags lack PHPUnit 10+ support
**Date:** 2026-02-24
**Problem:** Downloading the WP test suite from release tags (e.g. `tags/6.9.1`) included old code calling `PHPUnit\Util\Test::parseTestMethodAnnotations()`, which was removed in PHPUnit 10
**Solution:** Download the test suite from the `trunk` branch instead of release tags
**Prevention:** Always use `trunk` for the WP test suite — release tags don't get PHPUnit compatibility backports

### [Deps] PHPUnit 13 incompatible with WP test suite
**Date:** 2026-02-24
**Problem:** WordPress test suite + Yoast PHPUnit Polyfills only support up to PHPUnit 9.x; PHPUnit 13 failed at runtime
**Solution:** Downgraded PHPUnit from 13.0.5 to 9.6.34, added `yoast/phpunit-polyfills` 2.0.5
**Prevention:** Use PHPUnit 9.6.x for any project that needs the WordPress test suite (WP_UnitTestCase)

### [Deps] PHPUnit 9 uses @dataProvider annotations not attributes
**Date:** 2026-02-24
**Problem:** Unit tests used `#[DataProvider('...')]` attributes (PHPUnit 10+ syntax) which PHPUnit 9 ignores, causing "too few arguments" errors
**Solution:** Replaced `#[DataProvider]` attributes with `@dataProvider` doc-block annotations
**Prevention:** Use `@dataProvider` annotation syntax while on PHPUnit 9; only switch to attributes after upgrading to PHPUnit 10+

### [Infra] No svn or mysql CLI on macOS
**Date:** 2026-02-24
**Problem:** The standard WP test install script uses `svn export` and `mysqladmin`, neither of which is installed on macOS by default
**Solution:** Download WP test suite via GitHub tarballs (`curl` + `tar`) instead of `svn`; create database via `docker exec` instead of local `mysqladmin`
**Prevention:** Avoid `svn` and local DB CLI tools in install scripts; use `curl`/`tar` for downloads and `docker exec` for DB operations

### [Deps] Brain Monkey package name
**Date:** 2026-02-23
**Problem:** `brain-wp/brain-monkey` package not found by Composer
**Solution:** Correct package name is `brain/monkey`
**Prevention:** Always verify package names on Packagist before adding to composer.json

### [Test] Brain Monkey does not auto-stub translation functions
**Date:** 2026-02-23
**Problem:** `__()` calls in source code threw "not defined nor mocked" errors during unit tests
**Solution:** Call `Functions\stubTranslationFunctions()` and `Functions\stubEscapeFunctions()` explicitly in the base TestCase `setUp()` — `Monkey\setUp()` alone does not stub them
**Prevention:** Always include these stubs in the test base class when testing WordPress code that uses i18n/escaping

### [Test] Mockery overload conflicts across tests
**Date:** 2026-02-23
**Problem:** `Mockery::mock('overload:WC_Product_Simple')` can only define the class once per process; subsequent tests in the same run fail
**Solution:** Use DI (inject a factory closure into ProductService) so tests pass a mock via constructor instead of using `overload:`
**Prevention:** Prefer constructor injection over Mockery overload for classes instantiated inside methods

### [Test] PHPUnit 13 risky tests with Mockery expectations
**Date:** 2026-02-23
**Problem:** Tests that only verify behavior via Brain Monkey / Mockery expectations (no PHPUnit assertions) were marked "risky" in PHPUnit 13
**Solution:** Add `$this->addToAssertionCount($container->mockery_getExpectationCount())` in tearDown before Mockery::close()
**Prevention:** Always use a shared base TestCase that bridges Mockery expectations into PHPUnit assertion counts

### [Test] WP stubs conflict with Brain Monkey Patchwork
**Date:** 2026-02-23
**Problem:** Defining `is_wp_error()` in test stubs prevented Brain Monkey from mocking it (Patchwork error: "defined too early")
**Solution:** Only stub WP *classes* (WP_Error, WP_REST_Request, WP_REST_Response) in stubs; let Brain Monkey handle *function* mocking
**Prevention:** Never define PHP functions in test stubs that Brain Monkey might need to mock — only stub classes

---

*Add new lessons above this line*

Categories: `Config`, `Deps`, `Logic`, `Types`, `Test`, `Infra`, `Arch`, `WP`, `Security`
