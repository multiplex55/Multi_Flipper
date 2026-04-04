#!/usr/bin/env python3
"""Lightweight README documentation checks for pinned opportunities docs."""

from __future__ import annotations

import pathlib
import re
import sys


README = pathlib.Path("README.md")


def require(text: str, needle: str, label: str, errors: list[str]) -> None:
    if needle not in text:
        errors.append(f"Missing {label}: {needle}")


def main() -> int:
    if not README.exists():
        print("README.md not found", file=sys.stderr)
        return 1

    text = README.read_text(encoding="utf-8")
    errors: list[str] = []

    # Required pinned section anchor.
    require(text, "## Pinned Opportunities Tab", "heading", errors)

    # UI labels / filter names must match component labels.
    for label in ("Pin", "Last scan", "24h", "Custom snapshot"):
        require(text, label, "UI label", errors)

    # Tab naming and API endpoint references.
    for endpoint in (
        "GET /api/pinned-opportunities",
        "POST /api/pinned-opportunities",
        "DELETE /api/pinned-opportunities/{opportunityKey}",
        "POST /api/pinned-opportunities/snapshots",
    ):
        require(text, endpoint, "endpoint", errors)

    # If README has a TOC, ensure new anchor is linked.
    has_toc = bool(re.search(r"(?im)^##\s+table of contents\s*$", text))
    if has_toc and "(#pinned-opportunities-tab)" not in text.lower():
        errors.append("README has a Table of Contents but is missing link to #pinned-opportunities-tab")

    if errors:
        print("README validation failed:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("README validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
