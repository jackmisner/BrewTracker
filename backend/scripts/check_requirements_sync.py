"""Fail if requirements-prod.txt drifts from requirements.txt.

requirements.txt (dev + prod) and requirements-prod.txt (prod only, used by the
Docker image) pin the same versions. Run from the backend directory:

    python scripts/check_requirements_sync.py
"""

import re
import sys


def read_pins(path):
    pins = {}
    for line in open(path):
        line = line.split("#")[0].strip()
        match = re.match(r"^([A-Za-z0-9_.\-]+)==(\S+)$", line)
        if match:
            name = re.sub(r"[-_.]+", "-", match.group(1)).lower()
            pins[name] = match.group(2)
    return pins


def main():
    dev = read_pins("requirements.txt")
    prod = read_pins("requirements-prod.txt")
    drift = [
        f"{name}: requirements-prod.txt={version}, "
        f"requirements.txt={dev.get(name, 'MISSING')}"
        for name, version in sorted(prod.items())
        if dev.get(name) != version
    ]
    if drift:
        print("requirements-prod.txt is out of sync with requirements.txt:")
        print("\n".join(drift))
        return 1
    print(f"OK: {len(prod)} production pins match requirements.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
