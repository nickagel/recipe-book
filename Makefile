PORT ?= 8000
PYTHON ?= python
PID_FILE := .server.pid

.PHONY: start stop restart index

start:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (pid $$(cat $(PID_FILE))) at http://localhost:$(PORT)"; \
	else \
		$(PYTHON) --version > /dev/null 2>&1 || { echo "$(PYTHON) unavailable; run: pyenv install 3.15"; exit 1; }; \
		$(PYTHON) -m http.server $(PORT) --bind 127.0.0.1 > /dev/null 2>&1 & echo $$! > $(PID_FILE); \
		echo "Server started at http://localhost:$(PORT)"; \
	fi

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null && echo "Server stopped" || echo "Server not running"; \
		rm -f $(PID_FILE); \
	else \
		echo "Server not running"; \
	fi

restart: stop start

# Rebuild recipes/index.json from recipe folders, sorted alphabetically.
index:
	@$(PYTHON) -c 'import json, pathlib; \
	p = pathlib.Path("recipes/index.json"); \
	old = set(json.loads(p.read_text())) if p.exists() else set(); \
	new = sorted(d.name for d in pathlib.Path("recipes").iterdir() if (d / "description.yml").is_file()); \
	p.write_text(json.dumps(new, indent=2) + "\n"); \
	[print("+", s) for s in sorted(set(new) - old)]; \
	[print("-", s) for s in sorted(old - set(new))]; \
	print(f"{len(new)} recipes in {p}")'
