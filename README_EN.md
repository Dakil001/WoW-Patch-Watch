# WoW Patch Watch 1.0.5

A Windows and macOS desktop app for tracking current World of Warcraft Live and PTR/Test Realm versions and the possible impact on your addons.

## New in version 1.0.5

- The **“melden”** label has been replaced with **“Benachrichtigen”** in German and **“Notify”** in English.
- The complete app can now be switched between **German and English**.
- The language selector is available under **Settings → Language**.
- A language change applies to:
  - the main window and client cards
  - settings and client management
  - the native Windows/macOS menu bar
  - the tray menu
  - status, error and confirmation messages
  - desktop notifications
  - test emails and patch-change emails
- English mode prefers English Blizzard News; German mode prefers German Blizzard News.
- Dates and times use the selected locale.
- Existing 1.0.4 installations initially remain in German and keep all stored data.

## Clients tracked by default

- Classic Era
- Classic TBC / Burning Crusade Anniversary
- Classic Pandaria
- Retail
- matching PTR/Test Realm products whenever a compatible build is available

## Main features

- Current Live patch version
- Automatically calculated WoW Interface ID for TOC and Lua checks
- Matching PTR/Test Realm build and an indicator showing whether it is newer than Live
- Fourteen-day build history and official Blizzard notices
- Any number of addon names assigned to each client
- Separate Live and PTR notification switches per client
- Desktop notifications and optional SMTP email delivery
- Patch-change emails explicitly list the addons assigned to the client
- Client management for showing, hiding, adding, editing and deleting custom clients
- Up to four client cards per page
- Window width automatically matches the number of cards on the current page
- Background operation and optional login startup
- SMTP passwords encrypted through Electron `safeStorage`

## Changing the language

1. Open **Settings**.
2. Select **German** or **English** in the **Language** field.
3. Click **Save**.

The selection is stored in the local `state.json`. The native menu bar and tray menu are rebuilt immediately. Blizzard News is refreshed in the preferred language after a language change.

## Notification switches

Each client card contains separate switches for:

- **Live – Notify**
- **PTR / Test Realm – Notify**

When enabled, a newly detected change on that channel triggers a desktop notification. When SMTP delivery is configured and enabled, an email is also sent. Version checks, display and history recording continue even when a switch is disabled.

## Addons in change emails

Addon names entered under **Assigned addons** are listed in the email:

```text
Retail – PTR/Test realm
Previous: 12.0.6.x (Build ..., Interface ID 120006)
New: 12.0.7.x (Build ..., Interface ID 120007)

Affected addons:
- Swift
- MyProgress
```

## Adding a future WoW client

Use **Clients → Add new client**.

Required:

1. Display name
2. Live client ID, using the Battle.net product name

Optional:

- Live version prefixes
- PTR client ID
- PTR version prefixes

Separate multiple prefixes with commas:

```text
7.3, 7.4
```

An empty prefix field accepts every version returned by the product.

## Interface ID

The Interface ID is calculated from the first three components of the client version:

```text
Major × 10000 + Minor × 100 + Patch
```

Examples:

- `1.15.9.68808` → `11509`
- `2.5.6.68775` → `20506`
- `5.5.4.68806` → `50504`
- `12.0.7.68887` → `120007`

This is the value used after `## Interface:` in a WoW TOC file and in Lua interface checks.

## Building a Windows EXE

Requirements:

- Node.js 22 or newer
- npm

Steps:

1. Extract the source package completely.
2. Run `BUILD_WINDOWS.bat`.
3. Build output is written to `dist`.

Directly executable unpacked app:

```text
dist\win-unpacked\WoW Patch Watch.exe
```

An NSIS installer and a portable x64 EXE are also produced.

## Building macOS packages

On a Mac:

```bash
npm install
npm run dist:mac
```

This creates DMG and ZIP packages for Intel (`x64`) and Apple Silicon (`arm64`). Public distribution requires code signing and notarization.

## Updating from 1.0.4

The app ID and user-data directory are unchanged. The following data is preserved:

- visible and custom clients
- addon assignments
- notification switches
- SMTP settings and the encrypted password
- current builds, history and news

The existing state file is upgraded to schema 4 and receives `language: "de"` on first launch.

Data locations:

- Windows: `%APPDATA%\WoW Patch Watch\`
- macOS: `~/Library/Application Support/WoW Patch Watch/`

## Data sources

1. Blizzard Battle.net version service
2. BlizzTrack as a fallback and for fourteen-day history
3. Official Blizzard News JSON endpoint

## Limitations

- A future client requires its Battle.net product ID.
- Not every game branch has a permanently active PTR.
- Automatic classification of general Blizzard News focuses on the known default clients.
- Private Windows and macOS builds are unsigned unless you provide your own certificates.
