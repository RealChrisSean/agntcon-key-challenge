# Publication review

This handoff is a fresh source repository. It does not import the development workspace's Git history, screenshots, recorded terminal sessions, recovery archives, or account-specific deployment configuration.

## Included

- Application source, the supplied Fly.io logo, tests, and portable setup/check/reset scripts.
- An empty Connector selection example and a default public model name.
- Instructions for entering a new provider key in the Sprites dashboard.

## Excluded

- Provider API keys, organization tokens, personal agent authentication, and environment files.
- The original Connector ID, Sprite hostname/ID, organization settings, and checkpoint IDs.
- Chat/session histories, screenshots, logs, generated Claude profiles, and old backups.
- Agent instruction files and prefilled or automatically submitted challenge prompts.

The logo's PNG contains only image header, image data, and end chunks; it has no embedded text or EXIF metadata.

## Handoff verification

- Syntax checks and 12 tests passed, including Connector selection, missing access, SSE parsing, public HTTP routes, terminal origin handling on a different hostname, and launcher behavior.
- A temporary copy inside a Sprite automatically discovered an accessible Anthropic Connector and returned a real streamed application response.
- The handoff launcher also returned a genuine Claude response with provider token usage using a newly created dedicated profile, without a personal credential file. The temporary copy and profile were removed afterward.
- The setup script's service commands were checked against the runtime CLI. Full provisioning on a newly created Sprite and its first checkpoint restoration must still be rehearsed by the new operator.
- Gitleaks and the staged-file publication audit run before this source is published; their results apply to that reviewed source, not future edits.

## Repeat the check before publishing changes

Stage only the intended files, review the staged diff, then run:

```sh
python3 scripts/audit-publication.py
```

The script scans the Git index rather than just the working directory, blocks private/local artifacts, and reports file names and finding categories without printing suspected secret values. Also run a dedicated secret scanner such as [Gitleaks](https://github.com/gitleaks/gitleaks), with redaction, against both the candidate files and commit history.

Pattern scans support manual review; they cannot prove the absence of every possible secret. Never add a provider credential to an example or test fixture. Configure real credentials in the dashboard, keep local routing overrides ignored, and review every new binary or archive before publishing it.
