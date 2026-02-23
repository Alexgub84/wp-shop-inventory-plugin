# Dev Lessons

A log of bugs fixed and problems solved. Updated after fixing bugs or solving non-obvious problems.

---

<!-- Add new entries at the top -->

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
