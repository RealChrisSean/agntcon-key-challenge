# We Dare You to Steal Our API Keys

A conference booth demo: visitors chat with Claude, then open Claude Code in a floating browser terminal and try to find the application's raw provider API key.

Both the application and Claude Code call Anthropic through a **Sprites Connector**. The provider key is entered in the Sprites dashboard and attached by the gateway outside the Sprite. This repository contains no provider key or account-specific deployment configuration.

## Run your own demo

### 1. Create a disposable Sprite

On the operator computer, install the [Sprites CLI](https://docs.fly.io/sprites/cli/installation), sign in, and create a Sprite in your own organization:

```sh
sprite login
sprite create -o YOUR_ORG agntcon-key-challenge --skip-console
sprite console -o YOUR_ORG -s agntcon-key-challenge
```

Keep this organization's administration credentials on the operator computer. Use a Sprite with no personal agent logins or unrelated account access.

### 2. Install the demo inside that Sprite

```sh
git clone https://github.com/RealChrisSean/agntcon-key-challenge.git /home/sprite/agntcon-key-challenge
cd /home/sprite/agntcon-key-challenge
bash scripts/setup-sprite.sh
```

The setup installs ttyd if needed, prepares a dedicated Claude profile, and creates two wakeable services. It pins Claude Code to the version used by the original demo, `2.1.251`. Node.js 22+ and Python 3 are required; the standard Sprite image supplies them.

### 3. Add your Anthropic Connector

In the [Fly dashboard](https://fly.io/dashboard), select your organization, then **Sprites → Connectors → Add connector → Anthropic**. Enter your provider key only in that form and grant the demo Sprite access. Turn off **Allow all sprites** and restrict access to your demo. Allow the Messages, token-counting, and model-list endpoints.

**The app and Claude Code automatically discover the accessible Anthropic Connector. No ID or API key needs to be pasted into the code.** If you already opened the app, use its connection retry or refresh after saving the Connector.

Use a dedicated provider key/workspace with provider-enforced spending limits. An attendee can call an accessible Connector directly and incur charges without recovering its raw key. Exclude unrelated Connectors from the demo Sprite's access.

### 4. Verify and open it

Inside the Sprite:

```sh
node scripts/doctor.mjs
node scripts/doctor.mjs --live
```

The first command checks configuration and services. `--live` makes billable app and Claude Code requests and checks actual model output and token usage. It does not submit an investigation prompt.

On the operator computer:

```sh
sprite url -o YOUR_ORG -s agntcon-key-challenge
sprite url update --auth public -o YOUR_ORG -s agntcon-key-challenge
```

Open the printed URL. Making it public exposes the full demo terminal to anyone who can reach it. Use a dedicated disposable Sprite for this challenge. To return it to authenticated access, use `--auth sprite`.

## The booth experience

1. Send a prompt and watch the actual streamed reply. Messages stay in the page until refresh, and follow-ups include the earlier conversation. **Cmd + Enter** or **Ctrl + Enter** sends a message.
2. Click **Open Claude Code**. It opens an empty input in a movable, resizable terminal. The attendee chooses their own prompts. Minimize and Restore preserve the same session; there is no Close button.
3. Claude can inspect and modify the demo. Exiting Claude returns to a full shell inside the Sprite, including `sudo`. If Claude declines a request, direct terminal inspection remains available. Its normal tool approvals remain enabled.
4. Judge actual evidence of a raw provider key. A working API call, Connector ID, or gateway URL is not a recovered key.
5. Show `app/connector.mjs`: the request sends the conversation without a provider credential. Reset before the next attendee.

The repo adds no `AGENTS.md`, `CLAUDE.md`, canned challenge prompt, or application system prompt. Claude Code has its own normal built-in behavior.

See [the operator guide](docs/OPERATOR.md) for checkpoints, reset, and the explanation to show visitors.

## Optional routing settings

One accessible Anthropic Connector works without a configuration file. If several are available, select one explicitly with an ignored local override:

```sh
cp app/config.example.json app/config.json
```

Set its non-secret `connectorId`, and optionally change `model`. The default is `claude-sonnet-4-6`. These are the only accepted settings. `app/config.json` is ignored by Git; provider credentials always belong in the dashboard.

If discovery fails, check that the process is inside a Sprite in the Connector's organization and that its access policy permits that Sprite. If the model is unavailable, choose a permitted Claude model in the local override. If several Connectors are visible, `node app/resolve-config.mjs` reports the configuration error.

## Development and review

```sh
npm run check
npm start
```

The app has no npm runtime dependencies. A local preview runs at `http://127.0.0.1:8080`; model access and the embedded terminal require the Sprite setup. Outside a Sprite, the app reports itself unconfigured and does not generate a simulated response.

The small codebase consists of the streamed HTTP app, Connector discovery/request code, the terminal proxy, and the Claude launcher. [Publication review notes](docs/PUBLICATION-REVIEW.md) describe the exclusions and repeatable sensitive-data check.

## References

- [Sprites Connectors](https://fly.io/connectors/)
- [Add an Anthropic Connector](https://fly.io/sprites/ecosystem/)
- [Sprites services and checkpoints](https://docs.fly.io/sprites/working-with-sprites)
- [Claude Code gateway configuration](https://code.claude.com/docs/en/llm-gateway)
