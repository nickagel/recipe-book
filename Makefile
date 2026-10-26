### Machine Variables ###
SHELL:=/usr/bin/env bash -O extglob -O globstar -o pipefail # brew install bash #

.PHONY: default help
default help: ## show help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[$$()% 0-9a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)


PORT ?= 8000
PYTHON ?= python
PID_FILE := .server.pid

.PHONY: start
start: ## start the local server
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (pid $$(cat $(PID_FILE))) at http://localhost:$(PORT)"; \
	else \
		$(PYTHON) --version > /dev/null 2>&1 || { echo "$(PYTHON) unavailable; run: pyenv install 3.15"; exit 1; }; \
		$(PYTHON) -m http.server $(PORT) --bind 127.0.0.1 > /dev/null 2>&1 & echo $$! > $(PID_FILE); \
		echo "Server started at http://localhost:$(PORT)"; \
	fi
.PHONY: stop ## stop the local server
stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null && echo "Server stopped" || echo "Server not running"; \
		rm -f $(PID_FILE); \
	else \
		echo "Server not running"; \
	fi

.PHONY: restart ## restart the local server
restart: stop start

.PHONY: index ## rebuild recipes/index.json from recipe folders
index:
	@$(PYTHON) -c 'import json, pathlib; \
	p = pathlib.Path("recipes/index.json"); \
	old = set(json.loads(p.read_text())) if p.exists() else set(); \
	new = sorted(d.name for d in pathlib.Path("recipes").iterdir() if (d / "description.yml").is_file()); \
	p.write_text(json.dumps(new, indent=2) + "\n"); \
	[print("+", s) for s in sorted(set(new) - old)]; \
	[print("-", s) for s in sorted(old - set(new))]; \
	print(f"{len(new)} recipes in {p}")'
