# Frigg

The open market for Omarchy. Developers publish freely, buyers pay them directly in sats.

## Get Frigg

```bash
curl -fsSL https://raw.githubusercontent.com/hasky00/Frigg/main/install.sh | bash
```

This adds the `frigg` command to `~/.local/bin` and a Frigg row under Install in the Omarchy menu. Then:

```bash
frigg                   # browse the store
frigg info hasky-shelf  # read about one app
frigg install hasky-shelf
```

## How it works

- `apps/` holds one JSON manifest per app, plus `index.json`, the catalog.
- Paying uses the developer's own Lightning address (LNURL-pay). Frigg never holds money.
- Installing downloads the app from the developer's repository and runs the developer's installer, after asking.
- Frigg does not review code. Read what you install.

## Status

Tested against a practice wallet and a copy of the catalog. Not yet tested with a real payment or on a real Omarchy machine.

Frigg is an independent project by Hasky Labs and is not affiliated with Omarchy or 37signals.

Copyright Hasky Labs, Copenhagen. All rights reserved.
