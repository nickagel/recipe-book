"""Normalize recipe CSV files and project JSON files in place."""
import csv
import io
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def write_if_changed(path, text):
    if path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")
        print("formatted", path.relative_to(ROOT))


def format_csv(path, quote_rows):
    rows = csv.reader(path.read_text(encoding="utf-8").splitlines())
    rows = [[cell.strip() for cell in row] for row in rows]
    rows = [row for row in rows if any(row)]
    header, body = rows[0], rows[1:]
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerow(header)
    quoting = csv.QUOTE_ALL if quote_rows else csv.QUOTE_MINIMAL
    csv.writer(out, quoting=quoting, lineterminator="\n").writerows(body)
    write_if_changed(path, out.getvalue())


def format_json(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    write_if_changed(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


for path in sorted(ROOT.glob("recipes/*/measurements.csv")):
    format_csv(path, quote_rows=False)
for path in sorted(ROOT.glob("recipes/*/instructions.csv")):
    format_csv(path, quote_rows=True)
for path in sorted(ROOT.glob("**/*.json")):
    if ".venv" not in path.parts:
        format_json(path)
