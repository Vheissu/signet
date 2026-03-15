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
  - [The window.signet API](#the-windowsignet-api)
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
| **Wallet** | View HIVE, HBD, and Hive Power balances with live USD conversion. Full Hive Engine L2 token support with per-token price charts. |
| **Transfers** | Send HIVE and HBD to any account. Memo support (plaintext and encrypted). |
| **Hive Engine Tokens** | View balances, transfer, stake, unstake, and delegate any Hive Engine token. Dedicated Tokens tab with D3.js price charts per token. |
| **QR Codes / Payment Links** | Receive page generates QR codes. Two modes: Signet-native (`hive://` URI) and Hivesigner mobile URL. Scan or paste a link to auto-fill the Send form. |
| **Staking** | Power Up (HIVE to HP) and Power Down (HP to HIVE). |
| **Delegation** | Delegate and undelegate Hive Power to any account. |
| **Governance** | Vote for witnesses, approve/reject proposals (DHF), and set a voting proxy. |
| **Savings** | Deposit and withdraw from on-chain savings accounts. |
| **Swap** | Convert between HIVE and HBD on-chain. |
| **Multi-Account** | Manage unlimited Hive accounts. Switch between them instantly. |
| **Account Key Editing** | Add or remove individual keys (posting, active, memo, owner) after initial account creation. |
| **dApp Integration** | Full `window.signet` API for web applications, including VSC/Magi smart contract support via `requestSignedCall`. Backward-compatible `window.hive_keychain` shim. |
| **VSC/Magi Smart Contracts** | `requestSignedCall()` lets dApps invoke VSC/Magi smart contract methods, broadcast as `custom_json` operations. |
| **Biometric Unlock** | WebAuthn-based Touch ID / Windows Hello support. Credential stored in the platform's Secure Enclave. |
| **Notification Center** | Monitors incoming transfers, claimable rewards, power down payments, savings interest, and delegation changes. Bell icon with unread badge. |
| **Transaction History** | Financial operations only (no votes/comments noise). Hive Engine operations labeled as "Token Sent", "Token Staked", etc. Filter by type. Each transaction links to Hive Hub. |
| **Auto-Lock** | Configurable idle timer (default 10 minutes). Wallet locks automatically when the browser is idle or the screen is locked. |
| **Nav State Persistence** | Popup remembers which page you were on when it closes. Reopening the popup restores your position. |
| **Resource Credits** | Live display of voting power and resource credit percentages. |
| **Configurable RPC** | Choose from multiple Hive API nodes or add your own. |
| **Theme Support** | Dark and light mode. |

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

---

## Installation

### From Source (Recommended)

**Prerequisites**: Node.js 18 or later.

```bash
git clone https://github.com/user/signet.git
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

Signet injects a `window.signet` API into every web page, enabling dApps to request wallet operations from the user. All methods return Promises and open a confirmation popup in the extension before executing.

### Detecting Signet

Signet dispatches a `signet_installed` event on the window when it is ready. You can detect it in two ways:

```javascript
// Option 1: Check the flag directly (if the page loaded after the extension)
if (window.signet && window.signet.isInstalled()) {
  console.log('Signet is available');
}

// Option 2: Listen for the event (recommended)
window.addEventListener('signet_installed', () => {
  console.log('Signet is available');
});
```

### The window.signet API

Every method returns a `Promise<SignetResponse>`. The user must approve each request in the extension popup. Requests time out after 5 minutes if no action is taken.

### API Reference

#### `requestHandshake()`

Verify that Signet is installed and the user has an unlocked wallet.

```javascript
const response = await window.signet.requestHandshake();
if (response.success) {
  console.log('Signet is connected');
}
```

---

#### `requestTransfer(from, to, amount, memo, currency)`

Request a HIVE or HBD transfer.

| Parameter | Type | Description |
|---|---|---|
| `from` | `string` | Sender's Hive username |
| `to` | `string` | Recipient's Hive username |
| `amount` | `string` | Amount to send (e.g. `"1.000"`) |
| `memo` | `string` | Transfer memo (use `""` for no memo) |
| `currency` | `string` | `"HIVE"` or `"HBD"` |

```javascript
const response = await window.signet.requestTransfer(
  'alice',
  'bob',
  '10.000',
  'Payment for services',
  'HIVE'
);
```

---

#### `requestVote(voter, author, permlink, weight)`

Cast an upvote or downvote on a post or comment.

| Parameter | Type | Description |
|---|---|---|
| `voter` | `string` | Voter's Hive username |
| `author` | `string` | Post author |
| `permlink` | `string` | Post permlink |
| `weight` | `number` | Vote weight: `-10000` to `10000` (10000 = 100% upvote) |

```javascript
const response = await window.signet.requestVote(
  'alice',
  'bob',
  'my-first-post',
  10000
);
```

---

#### `requestCustomJson(username, id, json, useActive)`

Broadcast a `custom_json` operation (used by Hive Engine, Splinterlands, and many other dApps).

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Account broadcasting the operation |
| `id` | `string` | Custom JSON id (e.g. `"ssc-mainnet-hive"`) |
| `json` | `string` | JSON payload as a string |
| `useActive` | `boolean` | `true` to sign with the active key instead of posting (default: `false`) |

```javascript
const response = await window.signet.requestCustomJson(
  'alice',
  'ssc-mainnet-hive',
  JSON.stringify({
    contractName: 'tokens',
    contractAction: 'transfer',
    contractPayload: { symbol: 'DEC', to: 'bob', quantity: '100' }
  }),
  true
);
```

---

#### `requestSignedCall(username, method, params, typeWif)`

Invoke a VSC/Magi smart contract method. Under the hood, this broadcasts a `custom_json` operation with the specified method and parameters, signed with the chosen key type. This is the primary way dApps interact with VSC (Virtual Smart Contracts) and Magi smart contract layers on Hive.

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Account calling the smart contract |
| `method` | `string` | Smart contract method name (e.g. `"deposit"`, `"withdraw"`, `"swap"`) |
| `params` | `string` | JSON-encoded parameters for the method |
| `typeWif` | `string` | Key type to sign with: `"posting"` (default), `"active"`, or `"memo"` |

```javascript
// Example: call a VSC smart contract method
const response = await window.signet.requestSignedCall(
  'alice',
  'deposit',
  JSON.stringify({ amount: '100.000', token: 'HIVE' }),
  'active'
);

if (response.success) {
  console.log('Smart contract call broadcast:', response.result);
} else {
  console.error('Call failed:', response.error);
}
```

---

#### `requestSignBuffer(username, message, role)`

Sign an arbitrary message buffer (used for authentication, proof of identity, etc.).

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Account to sign with |
| `message` | `string` | Message to sign |
| `role` | `string` | Key role: `"posting"` (default) or `"active"` |

```javascript
const response = await window.signet.requestSignBuffer(
  'alice',
  'Login challenge: abc123',
  'posting'
);
if (response.success) {
  console.log('Signature:', response.result);
}
```

---

#### `requestSignTransaction(username, tx, role)`

Sign a pre-built transaction object without broadcasting.

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Account to sign with |
| `tx` | `object` | Transaction object (dhive-compatible format) |
| `role` | `string` | Key role: `"posting"` or `"active"` (default: `"active"`) |

```javascript
const response = await window.signet.requestSignTransaction(
  'alice',
  {
    operations: [
      ['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' }]
    ],
    extensions: []
  },
  'active'
);
```

---

#### `requestDelegation(delegator, delegatee, vestingShares)`

Delegate Hive Power to another account. Set `vestingShares` to `"0.000000 VESTS"` to remove an existing delegation.

| Parameter | Type | Description |
|---|---|---|
| `delegator` | `string` | Account delegating HP |
| `delegatee` | `string` | Account receiving delegation |
| `vestingShares` | `string` | Amount in VESTS (e.g. `"1000.000000 VESTS"`) |

```javascript
const response = await window.signet.requestDelegation(
  'alice',
  'bob',
  '1000.000000 VESTS'
);
```

---

#### `requestPowerUp(from, to, amount)`

Convert liquid HIVE to Hive Power (stake).

| Parameter | Type | Description |
|---|---|---|
| `from` | `string` | Account providing the HIVE |
| `to` | `string` | Account receiving the Hive Power |
| `amount` | `string` | Amount (e.g. `"100.000 HIVE"`) |

```javascript
const response = await window.signet.requestPowerUp(
  'alice',
  'alice',
  '100.000 HIVE'
);
```

---

#### `requestPowerDown(account, vestingShares)`

Begin a 13-week Power Down to convert Hive Power back to liquid HIVE.

| Parameter | Type | Description |
|---|---|---|
| `account` | `string` | Account to power down |
| `vestingShares` | `string` | Amount in VESTS to power down |

```javascript
const response = await window.signet.requestPowerDown(
  'alice',
  '50000.000000 VESTS'
);
```

---

#### `requestWitnessVote(account, witness, approve)`

Vote for or unvote a Hive witness.

| Parameter | Type | Description |
|---|---|---|
| `account` | `string` | Voter's account |
| `witness` | `string` | Witness to vote for |
| `approve` | `boolean` | `true` to vote, `false` to unvote |

```javascript
const response = await window.signet.requestWitnessVote(
  'alice',
  'good-witness',
  true
);
```

---

#### `requestDecodeMemo(username, memo)`

Decrypt an encrypted memo using the account's memo key.

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Account whose memo key to use |
| `memo` | `string` | Encrypted memo string (starts with `#`) |

```javascript
const response = await window.signet.requestDecodeMemo(
  'alice',
  '#encoded-memo-here'
);
if (response.success) {
  console.log('Decoded:', response.result);
}
```

---

#### `requestEncodeMemo(username, receiver, message)`

Encrypt a memo so only the receiver can read it.

| Parameter | Type | Description |
|---|---|---|
| `username` | `string` | Sender's account |
| `receiver` | `string` | Recipient's account |
| `message` | `string` | Plaintext message to encrypt |

```javascript
const response = await window.signet.requestEncodeMemo(
  'alice',
  'bob',
  'This is a secret message'
);
if (response.success) {
  console.log('Encrypted memo:', response.result);
}
```

---

#### `requestConvert(owner, amount)`

Convert HBD to HIVE (3.5-day conversion via the blockchain's internal market).

| Parameter | Type | Description |
|---|---|---|
| `owner` | `string` | Account initiating the conversion |
| `amount` | `string` | Amount of HBD to convert (e.g. `"50.000 HBD"`) |

```javascript
const response = await window.signet.requestConvert(
  'alice',
  '50.000 HBD'
);
```

---

### Response Format

Every API method returns a `Promise` that resolves to a `SignetResponse` object:

```typescript
interface SignetResponse {
  success: boolean;   // true if the operation completed successfully
  result?: any;       // operation-specific result data (transaction ID, signature, etc.)
  error?: string;     // human-readable error message if success is false
}
```

**Example -- handling success and failure:**

```javascript
const response = await window.signet.requestTransfer(
  'alice', 'bob', '1.000', '', 'HIVE'
);

if (response.success) {
  console.log('Transfer broadcast:', response.result);
} else {
  console.error('Transfer failed:', response.error);
  // Possible errors:
  //   "Request timed out"       -- user did not respond within 5 minutes
  //   "User rejected request"   -- user clicked Deny
  //   "Wallet is locked"        -- wallet needs to be unlocked first
  //   "Key not available"       -- required key is not imported for this account
}
```

### Backward Compatibility with Hive Keychain

Signet exposes a `window.hive_keychain` object that mirrors the Hive Keychain API using callbacks. dApps built for Hive Keychain will work with Signet without any code changes.

```javascript
// This existing Hive Keychain code works as-is with Signet:
window.hive_keychain.requestTransfer(
  'alice', 'bob', '1.000', 'memo', 'HIVE',
  function(response) {
    console.log(response);
  }
);
```

The `requestSignedCall` method is also available through the `hive_keychain` shim for dApps that use the callback pattern:

```javascript
window.hive_keychain.requestSignedCall(
  'alice',
  'deposit',
  JSON.stringify({ amount: '100.000', token: 'HIVE' }),
  'active',
  function(response) {
    console.log(response);
  }
);
```

Signet also fires the `hive_keychain_installed` event for dApps that listen for it.

The `window.signet` Promise-based API is recommended for new integrations, as it supports `async`/`await` and provides a cleaner developer experience.

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

### How It Works

1. **Enrollment**: After unlocking the wallet with your master password, enable biometric unlock in Settings. Signet creates a WebAuthn credential (triggering the Touch ID / Windows Hello prompt), generates a random 256-bit AES key, encrypts your wallet password with that key, and stores the encrypted password and credential reference in `chrome.storage.local`.

2. **Unlock**: On the lock screen, choose "Unlock with fingerprint." Signet calls `navigator.credentials.get()`, which triggers the biometric prompt. On success, it decrypts the stored password and unlocks the wallet normally.

### Security Notes

- The WebAuthn private key material never leaves the platform authenticator (Secure Enclave on macOS, TPM on Windows).
- The wallet password is encrypted at rest with AES-256-GCM using a unique IV, even within the biometric storage.
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
| **Savings interest** | Shows your HBD savings balance and estimated monthly interest earnings. |
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
- **Price Charts**: Each token's detail page shows a D3.js-rendered 24-hour price chart with HIVE-denominated pricing, gradient fill, grid lines, and axis labels.
- **USD Valuation**: Total token value is calculated as token quantity multiplied by the token's HIVE price multiplied by the HIVE/USD rate.

### Dedicated Tokens Tab

The wallet dashboard includes a Tokens tab listing all Hive Engine tokens held by the active account, sorted by total HIVE value. Tapping a token opens its detail page with the price chart, full balance breakdown, and action buttons for transfer, stake, unstake, and delegate.

All Hive Engine write operations (transfer, stake, unstake, delegate, undelegate) are broadcast as `custom_json` operations with the id `ssc-mainnet-hive` and require the active key.

---

## Transaction History

The History page displays a filtered view of financial operations for the active account.

### What Is Shown

The history focuses on financially relevant operations and excludes noise like votes and comments. Supported operation types include:

- **L1 operations**: Transfers (sent/received), Power Up, Power Down, delegations, reward claims (author, curation, witness), savings deposits/withdrawals, conversions, and filled orders.
- **Hive Engine operations**: Labeled with human-readable names -- "Token Sent", "Token Received", "Token Staked", "Token Unstaked", "Token Delegated", "Token Undelegated", "Market Buy", "Market Sell".

### Filtering

Scrollable filter pills at the top let you narrow the view by category: All, Transfers, Tokens (Hive Engine), Power, Delegation, Rewards, and Savings. Each filter shows a count badge so you can see at a glance how many operations exist in each category.

### Hive Hub Links

Every transaction row includes a link icon (visible on hover) that opens the transaction on [Hive Hub](https://hub.peakd.com) (`hub.peakd.com/tx/<txid>`) in a new tab, providing full on-chain details.

---

## Account Key Management

After adding an account to Signet, you can add or remove individual keys at any time through the **Edit Account** page (accessible from Settings or the account menu).

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
      message-handler.ts       # Handles dApp requests from content scripts
    content/
      index.ts                 # Content script: bridges inpage <-> background
    inpage/
      index.ts                 # Injected API: window.signet + window.hive_keychain
    core/
      biometric/
        webauthn.ts            # WebAuthn biometric enrollment and authentication
      crypto/
        encryption.ts          # AES-256-GCM encryption via Web Crypto API
        hive-keys.ts           # Hive key validation and role identification
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
        History.tsx            # Transaction history (with filters)
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
