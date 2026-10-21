# Glimpse repository constraints

Read LOCKED-DESIGN-SYSTEM.md before UI changes. Preserve the approved typography, paper textures, colors, illustrations, page relationships, original photos and normalized selection coordinates. Any user-provided reference has priority.

Keep RevealProvider boundaries, SVG stroke reveal, original-photo preservation, local photo storage, MapKit adapters and Kimi Code settings. Use Mock/isolated fixtures for tests; never call a paid model or write the production photo store during automated checks.

Publication snapshots are release/0.4.0, release/0.5.0 and release/0.5.1; main follows the newest release. See CHANGELOG.md and docs/VERSION_HISTORY.md. Never commit API keys, user records, quality-suite files or account usage ledgers. Every visual delivery includes a before/after comparison.
