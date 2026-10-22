# Operator guide

## Before attendees arrive

Follow the README on a fresh disposable Sprite. Add your own restricted Anthropic Connector and verify both the app and Claude with `node scripts/doctor.mjs --live`. In the browser, send a prompt, ask a follow-up, and open the terminal. Confirm Claude starts with an empty input. Minimize/Restore should keep that same session, and dragging/resizing should work.

Attendees have full control of the Sprite. Use an attendee kiosk or isolated browser session without personal sign-ins or local shared folders. Keep the operator computer and its Sprites login separate. Review all Connectors visible to the Sprite; creating a restricted Anthropic Connector does not revoke other shared Connectors.

## Save your own baseline

After installation and a successful live rehearsal, create a checkpoint from the operator computer:

```sh
sprite checkpoint create -o YOUR_ORG -s agntcon-key-challenge --comment booth-ready
```

Record the returned checkpoint ID on the operator computer. IDs belong to each Sprite; this repo ships no historical deployment IDs or checkpoints.

## Demo sequence

Let the visitor use the application first. Then open Claude Code and let them decide what to investigate. They may inspect source, files, environment, and processes, or modify/delete the demo. Commands run inside the Sprite. Exiting Claude opens its shell. Keep the investigation inside that disposable environment; external accounts, providers, and the Sprites control plane are outside the challenge.

Do not bypass Claude's safeguards or imply a predetermined outcome. Judge evidence, and keep direct terminal inspection available if it declines.

## Explain the request

Show `app/connector.mjs`, especially `requestModel()`:

```js
fetch(`https://api.sprites.dev/v1/gateway/anthropic/${config.connectorId}/v1/messages`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: config.model, max_tokens: 1024, stream: true, messages })
});
```

There is no provider-key header or provider-key environment variable in that request. Sprites identifies the authorized Sprite, and the Connector attaches the stored provider credential outside it. The Connector ID is routing metadata. Authorized requests consume the provider's budget even when the raw key is never recovered.

The Claude launcher uses the same discovery and Connector, with a dedicated local Claude configuration directory. Its Foundry-compatible transport avoids supplying an API key or a personal subscription login. The Claude interface may label the transport as Microsoft Foundry; the URL still routes to the Sprites Anthropic Connector. The launcher preserves normal tool approvals and starts without an attendee prompt.

## Reset after an attempt

1. Close the attendee page and end its terminal session.
2. From the operator computer, restore your recorded baseline:

```sh
bash scripts/reset.sh YOUR_ORG agntcon-key-challenge YOUR_CHECKPOINT_ID
```

The script refuses to run inside a Sprite. It restores the selected checkpoint and runs the real app/Claude checks, which are billable. The command assumes the README's installation directory, `/home/sprite/agntcon-key-challenge`.

3. Start a fresh disposable attendee browser profile, or clear the previous site's data, service workers, and caches. A Sprite checkpoint does not reset browser state.
4. Reopen the demo and confirm it is ready before the next attempt.

Rehearse one restoration before running the booth: modify a harmless demo file, restore, then check the file, app, and Claude again. Checkpoints do not reset provider spend or external Connector policies.

Stock Sprites also exposes local checkpoint controls inside the machine. Full root access can reach those controls. Keep the source and baseline identity outside the Sprite and be prepared to recreate the demo; the app cannot enforce operator-only recovery authority against root.

## Services and maintenance

`booth-terminal` listens only on `127.0.0.1:7681`. `booth-app` exposes port 8080, depends on the terminal service, and proxies only that fixed loopback destination. Services restart when the Sprite wakes. Only `?arg=claude` or the ordinary shell mode is accepted; the URL cannot choose arbitrary launcher arguments. The terminal requires same-origin WebSocket requests and strips browser cookies and Authorization before forwarding to ttyd.

```sh
sprite-env services list
sprite-env services restart booth-terminal
sprite-env services restart booth-app
```

Run those commands inside the Sprite. Rerunning `bash scripts/setup-sprite.sh` restarts this checkout's existing services; it refuses to take over service definitions belonging to another installation. After an intentional upgrade, rehearse again and create a new baseline.
