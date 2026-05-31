#!/usr/bin/env python3
import re
import sys
from pathlib import Path

USAGE = "usage: bump_version.py patch|minor|major"
PYPROJECT = Path("pyproject.toml")
INIT = Path("src/flowsh_cli/__init__.py")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"patch", "minor", "major"}:
        sys.exit(USAGE)

    pyproject = PYPROJECT.read_text(encoding="utf-8")
    match = re.search(r'^version = "(.+?)"', pyproject, re.M)
    if match is None:
        sys.exit("version not found in pyproject.toml")

    parts = [int(part) for part in match.group(1).split(".")]
    index = {"major": 0, "minor": 1, "patch": 2}[sys.argv[1]]
    parts[index] += 1
    for reset_index in range(index + 1, 3):
        parts[reset_index] = 0
    version = ".".join(str(part) for part in parts)

    PYPROJECT.write_text(
        re.sub(r'^version = ".*?"', f'version = "{version}"', pyproject, count=1, flags=re.M),
        encoding="utf-8",
    )

    init = INIT.read_text(encoding="utf-8")
    INIT.write_text(
        re.sub(r'^__version__ = ".*?"', f'__version__ = "{version}"', init, count=1, flags=re.M),
        encoding="utf-8",
    )

    print(f"Bumped to {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
