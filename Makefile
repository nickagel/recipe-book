### Machine Variables ###
SHELL:=/usr/bin/env bash -O extglob -O globstar -o pipefail # brew install bash #

.PHONY: default help
default help: ## show help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[$$()% 0-9a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)


PORT ?= 8000
PYTHON ?= python
PID_FILE := .server.pid
VENV := .venv
BIN := $(VENV)/bin

.PHONY: start
start: ## start the local server
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (pid $$(cat $(PID_FILE))) at http://localhost:$(PORT)"; \
	else \
		$(PYTHON) --version > /dev/null 2>&1 || { echo "$(PYTHON) unavailable; run: pyenv install 3.15"; exit 1; }; \
		$(PYTHON) -m http.server $(PORT) --bind 127.0.0.1 > /dev/null 2>&1 & echo $$! > $(PID_FILE); \
		echo "Server started at http://localhost:$(PORT)"; \
	fi
.PHONY: stop
stop: ## stop the local server
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null && echo "Server stopped" || echo "Server not running"; \
		rm -f $(PID_FILE); \
	else \
		echo "Server not running"; \
	fi

.PHONY: restart
restart: stop start ## restart the local server

.PHONY: index
index: ## rebuild recipes/index.json from recipe folders
	@$(PYTHON) -c 'import json, pathlib; \
	p = pathlib.Path("recipes/index.json"); \
	old = set(json.loads(p.read_text())) if p.exists() else set(); \
	new = sorted(d.name for d in pathlib.Path("recipes").iterdir() if (d / "description.yml").is_file()); \
	p.write_text(json.dumps(new, indent=2) + "\n"); \
	[print("+", s) for s in sorted(set(new) - old)]; \
	[print("-", s) for s in sorted(old - set(new))]; \
	print(f"{len(new)} recipes in {p}")'

.PHONY: install
install: ## install formatting tools into .venv
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install -q -r requirements.txt

.PHONY: format
format: ## format yml, csv, json, js and html files
	@[ -x $(BIN)/yamlfix ] || { echo "run: make install"; exit 1; }
	$(BIN)/yamlfix $$(find recipes .github .claude -name '*.yml')
	$(PYTHON) scripts/format_data.py
	$(BIN)/js-beautify --replace --indent-size 2 app.js
	# djlint exits 1 when it reformats a file
	$(BIN)/djlint index.html --reformat --quiet || [ $$? -eq 1 ]
