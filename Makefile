.PHONY: test test-plugin test-router

test: test-plugin

test-plugin:
	cd plugin && composer test:run

test-router:
	@echo "Router tests not yet configured"
