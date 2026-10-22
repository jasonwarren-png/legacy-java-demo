#!/usr/bin/env python3
"""Prints a compact diff for each mismatch in contract/results/<profile>-mismatches.json."""
import json, sys
from pathlib import Path

profile = sys.argv[1] if len(sys.argv) > 1 else 'h2'
items = json.loads((Path(__file__).parent / 'results' / f'{profile}-mismatches.json').read_text())
for item in items:
    java, node = item['java'], item['node']
    print(f"## {item['name']}")
    if java['status'] != node['status']:
        print(f"  status: java={java['status']} node={node['status']}")
    for key in sorted(set(java['headers']) | set(node['headers'])):
        if java['headers'].get(key) != node['headers'].get(key):
            print(f"  header {key}: java={java['headers'].get(key)!r} node={node['headers'].get(key)!r}")
    jb, nb = java['body'], node['body']
    if jb != nb:
        if isinstance(jb, str) and isinstance(nb, str):
            i = next((k for k in range(min(len(jb), len(nb))) if jb[k] != nb[k]), min(len(jb), len(nb)))
            print(f"  body java: ...{jb[max(0, i - 100):i + 150]}")
            print(f"  body node: ...{nb[max(0, i - 100):i + 150]}")
        else:
            print(f"  body java: {json.dumps(jb)[:300]}")
            print(f"  body node: {json.dumps(nb)[:300]}")
