.PHONY: test test-plugin test-router test-e2e

test: test-plugin test-router

test-plugin:
	cd plugin && composer test:run

test-router:
	cd router && npm test

test-e2e:
	cd e2e && bash run.sh
