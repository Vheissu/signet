# Signet

**A modern, ultra-secure wallet for the Hive blockchain.**

Signet is a Chrome/Chromium browser extension that lets you manage Hive accounts, sign transactions, and interact with dApps -- all with military-grade encryption that never lets your private keys leave your device.

---

## Table of Contents

- [Features](#features)
- [Security Model](#security-model)
- [Installation](#installation)
- [Building from Source](#building-from-source)
- [Developer Guide -- dApp Integration](#developer-guide----dapp-integration)
  - [Detecting Signet](#detecting-signet)
  - [API Reference](#api-reference)
  - [Response Format](#response-format)
  - [Backward Compatibility with Hive Keychain](#backward-compatibility-with-hive-keychain)
- [QR Codes and Payment Links](#qr-codes-and-payment-links)
- [Biometric Unlock](#biometric-unlock)
- [Notification Center](#notification-center)
- [Hive Engine Tokens](#hive-engine-tokens)
- [Transaction History](#transaction-history)
- [Account Key Management](#account-key-management)
- [Password Manager Import](#password-manager-import)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

| Category | Capabilities |
|---|---|
| **Wallet** | View HIVE, HBD, and Hive Power balances with live USD conversion and real CoinGecko price history (1h to 1y). Full Hive Engine L2 token support with 30-day market charts per token. |
| **Transfers** | Send HIVE and HBD to any account. Memos starting with `#` are encrypted with your memo key; encrypted memos in History decrypt on demand. |
| **Hive Engine Tokens** | View balances, transfer, stake, unstake, and delegate any Hive Engine token. Dedicated Tokens tab with D3.js price charts per token. |
| **QR Codes / Payment Links** | Receive page generates QR codes. Two modes: Signet-native (`hive://` URI) and Hivesigner mobile URL. Scan or paste a link to auto-fill the Send form. |
| **Staking** | Power Up (HIVE to HP) and Power Down (HP to HIVE). |
| **Delegation** | Delegate and undelegate Hive Power to any account. |
| **Governance** | Vote for witnesses, approve/reject proposals (DHF), and set or clear a voting proxy. |
| **Savings** | Deposit and withdraw from on-chain savings accounts. |
| **Swap** | Convert between HIVE and HBD on-chain, with estimates from the witness median price feed. |
| **Multi-Account** | Manage unlimited Hive accounts. Switch between them instantly. |
| **Account Import** | Add an account with any private key or with the master password, which derives the posting, active and memo keys (the owner key is never stored unless pasted). Add or remove individual keys later. |
| **dApp Integration** | Every request from a web page opens an approval window showing the site, account, key role and full operation. Full `window.signet` API plus a `window.hive_keychain` shim with Keychain's exact signatures, so PeakD, Ecency, Splinterlands and other Keychain dApps work unchanged. |
| **VSC/Magi Smart Contracts** | `requestSignedCall()` lets dApps invoke VSC/Magi smart contract methods, broadcast as `custom_json` operations. |
| **Biometric Unlock** | WebAuthn-based Touch ID / Windows Hello support. Credential stored in the platform's Secure Enclave. |
| **Notification Center** | Monitors incoming transfers, claimable rewards, power down payments, savings interest, and delegation changes. Bell icon with unread badge. |
| **Transaction History** | Financial operations only (no votes/comments noise), including savings interest, power down payments and recurring transfers. Hive Engine operations labeled as "Token Sent", "Token Staked", etc. Filter by type, page back through older activity, and open any transaction on Hive Hub. |
| **Auto-Lock** | Configurable timeout (default 10 minutes). The wallet locks after that long without using the popup, when the OS reports you idle for that long, or immediately when the screen locks. |
| **Nav State Persistence** | Popup remembers which page you were on when it closes. Reopening the popup restores your position. |
| **Resource Credits** | Live display of voting power and resource credit percentages. |
| **Configurable RPC** | Choose from multiple Hive API nodes or add your own, with a latency test. The first node is primary and the rest are failovers. |
| **Theme Support** | Dark and light themes. The font ships with the extension; nothing is fetched from Google Fonts. |

---

## Security Model

Signet was designed with a security-first philosophy. Every cryptographic operation uses the **Web Crypto API** -- the browser's native, hardware-accelerated cryptography implementation -- rather than JavaScript crypto libraries.

### Encryption at Rest -- AES-256-GCM

All private keys are encrypted with **AES-256-GCM** before being stored in `chrome.storage.local`.

- **Authenticated encryption**: The GCM authentication tag detects any tampering with the ciphertext. If a single bit is modified, decryption fails.
- **Unique IV per encryption**: Every encrypt operation generates a cryptographically random 96-bit initialization vector, preventing nonce reuse.
- **Unique salt per encryption**: Each key derivation uses a random 128-bit salt.

### Key Derivation -- PBKDF2 with 600,000 Iterations

Your master password is transformed into an AES-256 key via PBKDF2-SHA256 with **600,000 iterations**. For comparison:

| Wallet | KDF | Iterations |
|---|---|---|
| **Signet** | PBKDF2-SHA256 | **600,000** |
| Industry "standard" | PBKDF2-SHA256 | ~10,000 |
| OWASP 2023 minimum | PBKDF2-SHA256 | 600,000 |

This is the OWASP-recommended minimum for 2023 and beyond, making brute-force attacks computationally infeasible.

### Native Implementation

The Web Crypto API runs in the browser's native (C++/Rust) layer, not in JavaScript. This provides:

- **Timing-attack resistance**: Operations run in constant time at the native level.
- **Key isolation**: `CryptoKey` objects are opaque -- JavaScript cannot inspect the raw key material.
- **No supply-chain risk**: No third-party crypto libraries to audit or worry about.

### Session Password Storage

Your password is held in `chrome.storage.session`, which is:

- **Ephemeral**: Cleared automatically when the browser closes.
- **Extension-scoped**: Inaccessible to web pages, other extensions, or content scripts.
- **Not written to disk**: Exists only in memory for the duration of the browser session.

### Keys Never Leave the Device

Private keys are decrypted only in memory at the moment a transaction is signed. They are never transmitted, never logged, and never written to disk in plaintext.

### Every dApp Request Is Approved By You

Web pages cannot sign anything on their own. A request from a page is queued by the background worker and shown in a dedicated approval window that lists the requesting origin (taken from the browser, not from the page), the account, the key role that will sign, and the complete operation. Privileged messages such as "deliver this response" or "unlock" are only accepted from Signet's own extension pages, never from content scripts.

---

## Installation

### From Source (Recommended)

**Prerequisites**: Node.js 18 or later.

```bash
git clone https://github.com/Vheissu/signet.git
cd signet
npm install
npm run build
```

Then load the extension into Chrome:

1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` directory inside the project.

The Signet icon will appear in your browser toolbar.

### Development Mode

For live-reloading during development:

```bash
npm run dev
```

This runs `vite build --watch` in development mode. After each change, reload the extension from `chrome://extensions`.

---

## Building from Source

The build process produces a complete extension in the `dist/` directory:

```bash
npm run build
```

This runs `scripts/build.js`, which performs four steps:

1. **Icon generation** -- Creates 16px, 48px, and 128px PNG icons programmatically.
2. **Popup build** -- Vite bundles the React popup UI with Tailwind CSS.
3. **Service worker build** -- esbuild bundles `src/background/index.ts` as an IIFE (no eval/Function, MV3-safe).
4. **Content and inpage scripts** -- esbuild bundles the content script and the injected inpage script.

The output is a ready-to-load Chrome extension:

```
dist/
  manifest.json
  index.html
  background.js
  content.js
  inpage.js
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
  assets/
    popup-[hash].js
    popup-[hash].css
```

---

## Developer Guide -- dApp Integration

Signet injects a `window.signet` API into every web page before any page script runs. dApps use it to ask the wallet to sign or broadcast operations. Nothing is ever signed silently: every request opens a Signet approval window showing the requesting site, the account, the key role involved and the full operation, and the page only gets a response once the user approves or rejects.

### Detecting Signet

```javascript
// The API is present before your scripts run, so a direct check is enough:
if (window.signet) {
  console.log('Signet is available, version', window.signet.version);
}

// Listening for the event also works (fires once per page load):
window.addEventListener('signet_installed', () => { /* ... */ });
```

### The window.signet API

Every method returns a `Promise<SignetResponse>`. Each method also accepts an optional trailing `callback` for Keychain-style code. Where a method takes a `username`, you may pass `null` to let the user choose the account in the approval window. Requests time out after 10 minutes if the user takes no action.

### API Reference

| Method | Signs with | Description |
|---|---|---|
| `requestHandshake()` | -- | Confirms Signet is installed; resolves with the extension version. |
| `requestTransfer(from, to, amount, memo, currency, cb?, enforce?)` | active | Send HIVE or HBD. `amount` is a plain number string like `"1.000"`. Memos starting with `#` are encrypted. |
| `requestVote(voter, author, permlink, weight)` | posting | Vote on a post or comment. `weight` is `-10000` to `10000`. |
| `requestPost(username, title, body, parentPermlink, parentAuthor, jsonMetadata, permlink, commentOptions?)` | posting | Publish a post or comment, optionally with `comment_options`. |
| `requestCustomJson(username, id, json, useActive?, display?)` | posting / active | Broadcast a `custom_json` operation (Hive Engine, games, follows). |
| `requestSignBuffer(username, message, role?, cb?, title?)` | posting / active / memo | Sign an arbitrary message. Resolves with the hex signature and `publicKey`. |
| `requestSignTransaction(username, tx, role?)` | active / posting | Sign a transaction without broadcasting. Missing `ref_block_*`/`expiration` are filled in. |
| `requestBroadcast(username, operations, role?)` | posting / active | Sign and broadcast any array of `[name, payload]` operations. |
| `requestDelegation(delegator, delegatee, amount, unit?)` | active | Delegate Hive Power. `unit` is `"HP"` or `"VESTS"`; `"0"` removes a delegation. |
| `requestPowerUp(from, to, amount)` | active | Convert liquid HIVE to Hive Power. |
| `requestPowerDown(account, amount, unit?)` | active | Start a 13-week power down. Amount in HP by default. |
| `requestWitnessVote(account, witness, approve)` | active | Vote for or unvote a witness. |
| `requestProxy(account, proxy)` | active | Set a voting proxy, or pass `""` to clear it. |
| `requestUpdateProposalVote(voter, proposalIds, approve)` | active | Approve or unapprove DHF proposals. |
| `requestEncodeMemo(username, receiver, message, role?)` | memo | Encrypt a message for another account. |
| `requestDecodeMemo(username, memo, role?)` | memo | Decrypt a `#`-prefixed memo. |
| `requestAddAccountAuthority(username, authorizedUsername, role, weight?)` | active | Grant another account posting or active authority. |
| `requestRemoveAccountAuthority(username, authorizedUsername, role)` | active | Revoke that authority. |
| `requestConvert(owner, amount, collateralized?)` | active | Convert HBD to HIVE, or HIVE to HBD when `collateralized` is true. |
| `requestRecurrentTransfer(from, to, amount, currency, memo, recurrenceHours, executions)` | active | Schedule a recurring transfer. |
| `requestSendToken(username, to, amount, memo, symbol)` | active | Transfer a Hive Engine token. |
| `requestSignedCall(username, method, params, typeWif?)` | posting / active | VSC/Magi smart contract call, broadcast as `custom_json` with `method` as the id. |

**Example -- login with a signed challenge:**

```javascript
const response = await window.signet.requestSignBuffer(null, `login:${Date.now()}`, 'posting');
if (response.success) {
  // response.username is the account the user picked,
  // response.result is the hex signature, response.publicKey the posting key used.
  await fetch('/api/login', { method: 'POST', body: JSON.stringify(response) });
}
```

**Example -- Hive Engine custom JSON:**

```javascript
const response = await window.signet.requestCustomJson(
  'alice',
  'ssc-mainnet-hive',
  { contractName: 'tokens', contractAction: 'transfer',
    contractPayload: { symbol: 'LEO', to: 'bob', quantity: '100' } },
  true // active key
);
```

### Response Format

Responses use the same field names as Hive Keychain, so code written for either wallet can read them:

```typescript
interface SignetResponse {
  success: boolean;
  error: string | null;   // short code: "user_cancel", "timeout", "not_initialized", "error", ...
  message: string;        // human-readable explanation
  result: any;            // broadcast confirmation { id, block_num, ... }, signature, signed tx, encrypted memo...
  data: any;              // the original request payload plus its type
  request_id: string;
  publicKey?: string;     // for signBuffer / signTransaction / memo operations
  username?: string;      // for signBuffer when the user picked the account
}
```

A request is rejected (not just timed out) when the user clicks Reject, closes the approval window, or closes the tab that made the request. If the wallet is locked, the approval window asks for the password first and then shows the request, so dApps do not need to handle a separate "locked" state.

### Backward Compatibility with Hive Keychain

Signet exposes `window.hive_keychain` with the Hive Keychain method signatures and argument order, including Keychain's capitalised key names (`"Posting"`, `"Active"`, `"Memo"`). Existing dApps work without changes:

```javascript
window.hive_keychain.requestVote('alice', 'my-post', 'bob', 10000, (response) => {
  console.log(response.success, response.result);
});
```

Supported shim methods: `requestHandshake`, `requestVerifyKey`, `requestEncodeMessage`, `requestSignBuffer`, `requestAddAccountAuthority`, `requestRemoveAccountAuthority`, `requestBroadcast`, `requestSignTx`, `requestSignedCall`, `requestPost`, `requestVote`, `requestCustomJson`, `requestTransfer`, `requestSendToken`, `requestDelegation`, `requestWitnessVote`, `requestProxy`, `requestPowerUp`, `requestPowerDown`, `requestUpdateProposalVote`, `requestRecurrentTransfer`, `requestConversion`.

Signet also fires the `hive_keychain_installed` event. Only one of Signet and Hive Keychain should be enabled at a time, since both define `window.hive_keychain`.

---

## QR Codes and Payment Links

Signet supports QR codes and payment links for receiving Hive, with two URI formats designed for different use cases.

### Signet-Native URI (`hive://`)

Used for desktop Signet-to-Signet transfers. The Receive page generates a QR code encoding a `hive://` URI:

```
hive://transfer?to=alice&amount=10.000&currency=HIVE&memo=Thanks
```

When a sender pastes this link into the Send field, Signet auto-fills the recipient, amount, currency, and memo. Camera-based QR scanning is also supported.

### Hivesigner Mobile URL

For mobile users who do not have the extension, the Receive page can generate a Hivesigner URL:

```
https://hivesigner.com/sign/transfer?to=alice&amount=10.000%20HIVE&memo=Thanks
```

Scanning this QR code on a phone opens the Hivesigner web interface in the mobile browser, where the sender can sign the transfer without needing any extension or app installed.

### How It Works

1. Go to the **Receive** page and optionally fill in a requested amount, currency, and memo.
2. Signet generates a QR code (and a copyable link) for the transfer request.
3. The sender scans the QR code with a camera or pastes the link into their Send field.
4. If the link is a `hive://` URI, Signet parses it and auto-fills the Send form.
5. If the link is a Hivesigner URL, the sender's mobile browser opens Hivesigner for signing.

---

## Biometric Unlock

Signet supports unlocking with Touch ID (macOS), Windows Hello, or any other platform authenticator via the **WebAuthn** (Web Authentication) API.

Biometric unlock requires browser support for the WebAuthn **PRF** extension. If PRF is unavailable, Signet falls back to password-only unlock.

### How It Works

1. **Enrollment**: After unlocking the wallet with your master password, enable biometric unlock in Settings. Signet creates a WebAuthn credential (triggering the Touch ID / Windows Hello prompt), derives an AES key from the authenticator via the WebAuthn PRF extension, encrypts your wallet password with that key, and stores only the encrypted password plus non-secret credential metadata in `chrome.storage.local`.

2. **Unlock**: On the lock screen, choose "Unlock with fingerprint." Signet calls `navigator.credentials.get()`, which triggers the biometric prompt. On success, it derives the same AES key from the authenticator again, decrypts the stored password, and unlocks the wallet normally.

### Security Notes

- The WebAuthn private key material never leaves the platform authenticator (Secure Enclave on macOS, TPM on Windows).
- The wallet password is encrypted at rest with AES-256-GCM using a unique IV, and the decrypting key is not stored alongside the ciphertext.
- Biometric enrollment can be removed at any time from Settings, which deletes the stored credential and encrypted password.
- Platform authenticator attachment is enforced (`authenticatorAttachment: 'platform'`), meaning only built-in biometrics are accepted -- no external USB keys.

---

## Notification Center

Signet includes a notification system that monitors account activity and surfaces actionable alerts. A bell icon in the header shows an unread badge when new notifications arrive.

### Monitored Events

| Event | Description |
|---|---|
| **Incoming transfers** | Notifies when another account sends you HIVE or HBD. |
| **Claimable rewards** | Reminds you when author/curation rewards are available to claim. |
| **Power down payments** | Alerts when the next weekly power down payment is approaching. |
| **Savings interest** | Monthly reminder of your HBD savings balance and estimated interest at the current chain rate. |
| **Delegation changes** | Notifies when another account delegates HP to you. |

The monitor polls once per minute. Notifications are stored locally (up to 50) and can be marked as read individually or all at once, or cleared entirely. Tapping a notification navigates to the relevant page (e.g., tapping a transfer notification opens the History page).

---

## Hive Engine Tokens

Signet provides full support for Hive Engine (Layer 2) tokens alongside native HIVE and HBD.

### Capabilities

- **Balances**: View liquid, staked, delegated-in, delegated-out, and pending-unstake balances for every token you hold.
- **Transfers**: Send any Hive Engine token to another Hive account with an optional memo.
- **Staking**: Stake tokens to earn rewards or participate in governance.
- **Unstaking**: Begin unstaking tokens (subject to the token's cooldown period).
- **Delegation**: Delegate staked tokens to another account, or undelegate.
- **Price Charts**: Each token's detail page shows 30 days of daily closing prices from the Hive Engine market, priced in HIVE. Tokens with no trades say so instead of showing a chart.
- **USD Valuation**: Total token value is calculated as token quantity multiplied by the token's HIVE price multiplied by the HIVE/USD rate.

### Dedicated Tokens Tab

The wallet dashboard includes a Tokens tab listing all Hive Engine tokens held by the active account, sorted by total HIVE value. Tapping a token opens its detail page with the price chart, full balance breakdown, and action buttons for transfer, stake, unstake, and delegate.

All Hive Engine write operations (transfer, stake, unstake, delegate, undelegate) are broadcast as `custom_json` operations with the id `ssc-mainnet-hive` and require the active key.

---

## Transaction History

The History page displays a filtered view of financial operations for the active account.

### What Is Shown

The history focuses on financially relevant operations and excludes noise like votes and comments. Supported operation types include:

- **L1 operations**: Transfers (sent/received/recurring), Power Up, Power Down and its weekly payments, delegations and returned delegations, reward claims (author, curation, benefactor, witness, proposal), savings deposits/withdrawals and interest, conversions, and filled orders.
- **Hive Engine operations**: Labeled with human-readable names -- "Token Sent", "Token Received", "Token Staked", "Token Unstaked", "Token Delegated", "Token Undelegated", "Market Buy", "Market Sell".

### Filtering

Scrollable filter pills at the top let you narrow the view by category: All, Transfers, Tokens (Hive Engine), Power, Delegation, Rewards, Savings, and Conversions. Each filter shows a count badge. A "Load older activity" button pages further back through the account's history.

### Encrypted Memos

Memos that start with `#` are encrypted on-chain. History shows them as "Encrypted memo"; tapping one decrypts it locally with your memo key.

### Hive Hub Links

Every transaction row includes a link icon (visible on hover) that opens the transaction on [Hive Hub](https://hub.peakd.com) (`hub.peakd.com/tx/<txid>`) in a new tab, providing full on-chain details.

---

## Account Key Management

When adding an account, paste either a private key or the account's master password into the single key field. A private key is matched to its role against the account's on-chain public keys; the master password derives the posting, active and memo keys and imports whichever ones match. The owner key is only stored if you paste it directly.

After adding an account, you can add or remove individual keys at any time through the **Edit Account** page (accessible from Settings or the account menu).

### Capabilities

- View which key roles (posting, active, memo, owner) are currently configured, with a status indicator for each.
- **Add a key**: Select a missing role, paste the private key, and Signet validates the WIF format and verifies that it matches the expected role by comparing against the account's on-chain public keys. If the key belongs to a different role than selected, Signet tells you which role it actually is.
- **Remove a key**: Delete a key you no longer need. Signet prevents you from removing the last remaining key on an account.

Each key role is explained inline: Posting (vote, comment, follow), Active (transfer, stake, delegate), Memo (encrypt/decrypt messages), Owner (change keys, recover account).

---

## Password Manager Import

Signet supports importing private keys that you have stored in a password manager. Export your vault as CSV and Signet will automatically detect the format and extract Hive credentials.

### Supported Formats

Signet auto-detects exports from **1Password**, **Bitwarden**, and **LastPass** by inspecting the CSV column headers. Generic CSV files are also supported if they contain recognizable Hive-related entries.

The parser looks for:
- WIF private keys (51-character base58 strings starting with `5`)
- Hive master passwords (starting with `P5`)
- Labeled keys in notes fields (e.g., "Posting Key: 5xxx...")

### 1Password

1. Open 1Password and go to **File > Export > All Items**.
2. Choose **CSV** format and save the file.
3. Open the CSV and find entries containing your Hive keys.
4. In Signet, go to **Add Account**, enter your username, and paste each key into the corresponding field.
5. Signet auto-detects the key role (posting, active, memo) by comparing against on-chain public keys.
6. Delete the exported CSV file after importing.

### Bitwarden

1. Open the Bitwarden web vault and go to **Tools > Export Vault**.
2. Choose **CSV (unencrypted)** and download.
3. Open the CSV and locate your Hive private keys (check the `login_password` or `notes` columns).
4. Paste each key into Signet's Add Account form.
5. Delete the exported CSV file after importing.

### LastPass

1. Open LastPass and go to **Account Options > Advanced > Export**.
2. Download the CSV file.
3. Search the file for your Hive account entries.
4. Paste the private keys into Signet's Add Account form.
5. Delete the exported CSV file after importing.

> **Important**: Always delete exported CSV files immediately after importing. They contain your passwords and private keys in plaintext.

---

## Project Structure

```
signet/
  public/
    manifest.json              # Chrome MV3 extension manifest
  scripts/
    build.js                   # Build script (Vite + esbuild)
  src/
    background/
      index.ts                 # Service worker: lifecycle, auto-lock, message routing
      message-handler.ts       # dApp request queue, approval window, auto-lock
    content/
      index.ts                 # Content script: relays page <-> background
    inpage/
      index.ts                 # MAIN-world script: window.signet + window.hive_keychain
    core/
      biometric/
        webauthn.ts            # WebAuthn biometric enrollment and authentication
      crypto/
        encryption.ts          # AES-256-GCM encryption via Web Crypto API
        hive-keys.ts           # Key validation, role detection, signing, memo encryption
      dapp/
        requests.ts            # Describes each dApp request type for the approval screen
        execute.ts             # Signs/broadcasts an approved request
      hive/
        client.ts              # Hive RPC client (dhive wrapper)
        operations.ts          # Amount parsing, VESTS/HP conversion, utilities
        rpc.ts                 # RPC node management and failover
      hive-engine/
        api.ts                 # Hive Engine sidechain API client
      import/
        csv-parser.ts          # Password manager CSV import (1Password, Bitwarden, LastPass)
      notifications/
        monitor.ts             # Notification polling and event detection
      prices/
        index.ts               # CoinGecko and Hive Engine price history with caching
      qr/
        index.ts               # QR code generation, scanning, and URI parsing
      storage/
        secure-storage.ts      # Chrome storage API wrapper (local + session)
      types/
        index.ts               # TypeScript type definitions
    popup/
      main.tsx                 # React entry point
      App.tsx                  # Root component and page router
      store/
        index.ts               # Zustand state management (with nav persistence)
      components/
        layout/
          Header.tsx           # App header with account switcher and notification bell
          BottomNav.tsx         # Bottom navigation bar
          PageContainer.tsx    # Page layout wrapper
        ui/
          Avatar.tsx           # Account avatar
          Badge.tsx            # Status badges
          Button.tsx           # Button component
          Card.tsx             # Card component
          Input.tsx            # Form input component
          Modal.tsx            # Modal dialog
          Spinner.tsx          # Loading spinner
          Toast.tsx            # Toast notifications
        wallet/
          ActionButtons.tsx    # Quick action buttons (Send, Receive, Stake, etc.)
          BalanceCard.tsx       # Account balance display
          ResourceBar.tsx      # Voting power and RC bar
          TokenList.tsx        # Hive Engine token list
          TransactionItem.tsx  # Transaction history row (with Hive Hub links)
      hooks/
        useAccounts.ts         # Account management hook
        useAuth.ts             # Authentication hook
        useHive.ts             # Blockchain data hook
      pages/
        Welcome.tsx            # First-run welcome screen
        CreatePassword.tsx     # Master password creation
        Login.tsx              # Unlock screen (with biometric option)
        Dashboard.tsx          # Main wallet dashboard
        Send.tsx               # Send HIVE/HBD (with QR/link auto-fill)
        Receive.tsx            # Receive (QR code generation)
        Staking.tsx            # Power Up / Power Down
        Delegation.tsx         # HP delegation management
        Governance.tsx         # Witness voting and proposals
        Savings.tsx            # Savings deposits and withdrawals
        Swap.tsx               # HIVE <-> HBD conversion
        History.tsx            # Transaction history (with filters and paging)
        ApproveRequest.tsx     # dApp request approval screen
        Settings.tsx           # Extension settings
        AddAccount.tsx         # Add/import a Hive account
        EditAccount.tsx        # Add/remove individual keys on an existing account
        TokenDetail.tsx        # Hive Engine token detail with D3.js price chart
      styles/
        index.css              # Tailwind CSS v4 entry point
    shims/
      buffer-shim.ts           # Buffer polyfill for dhive in browser
  index.html                   # Popup HTML shell
  vite.config.ts               # Vite configuration with MV3 eval-stripping plugin
  tsconfig.json                # TypeScript configuration
  package.json                 # Dependencies and scripts
  LICENSE                      # MIT License
```

---

## Tech Stack

| Technology | Role | Version |
|---|---|---|
| **TypeScript** | Language | 5.7 |
| **React** | Popup UI | 18.3 |
| **Vite** | Build tool (popup) | 6.0 |
| **esbuild** | Build tool (background, content, inpage scripts) | 0.24 |
| **Tailwind CSS** | Styling | v4.0 |
| **Zustand** | State management | 5.0 |
| **D3.js** | Token price charts | 7.x |
| **@hiveio/dhive** | Hive blockchain client | 1.3 |
| **Lucide React** | Icons | 0.468 |
| **Web Crypto API** | Encryption (AES-256-GCM, PBKDF2) | Native |
| **WebAuthn API** | Biometric authentication (Touch ID, Windows Hello) | Native |
| **qrcode** | QR code generation | -- |
| **jsQR** | QR code scanning (image and camera) | -- |
| **Chrome Extensions MV3** | Extension platform | Manifest V3 |

---

## License

MIT License. See [LICENSE](LICENSE) for details.
