"""
Run the canonical Python xer-parser on a fixture and emit a canonical-JSON model.

Usage:
    python python_emit.py <path-to-fixture.xer>

Emits JSON to stdout. Designed for the Node-side parity harness to consume.
"""
import json
import sys
from pathlib import Path

SKILL_SCRIPTS = Path.home() / ".claude" / "skills" / "xer-parser" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

from xer_parser import parse_xer  # noqa: E402


def canonicalize(obj):
    """Recursively sort dict keys and convert OrderedDict to dict for stable JSON."""
    if isinstance(obj, dict):
        return {k: canonicalize(obj[k]) for k in obj.keys()}
    if isinstance(obj, list):
        return [canonicalize(x) for x in obj]
    return obj


def main():
    if len(sys.argv) < 2:
        print("Usage: python python_emit.py <fixture.xer>", file=sys.stderr)
        sys.exit(2)

    fixture_path = sys.argv[1]
    data = parse_xer(fixture_path)

    # Strip the meta fields that the parity harness doesn't compare.
    out = {
        "ermhdr": canonicalize(data.get("ermhdr", {})),
        "tables": canonicalize(data.get("tables", {})),
    }
    print(json.dumps(out, default=str))


if __name__ == "__main__":
    main()
