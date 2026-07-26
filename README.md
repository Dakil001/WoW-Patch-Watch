# WoW Patch Watch

[![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)](#release-status)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#installation)
[![Electron](https://img.shields.io/badge/Electron-43.2.0-47848F.svg)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-WoW--Patch--Watch-181717?logo=github)](https://github.com/Dakil001/WoW-Patch-Watch)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/dakil)

**[English](#english) · [Deutsch](#deutsch)**

---

<a id="english"></a>

# English

WoW Patch Watch is a cross-platform desktop application for Windows and macOS that tracks current **World of Warcraft Live and PTR/Test Realm versions**, calculates the addon-relevant **Interface ID**, displays changes from the last 14 days, and helps you identify which of your addons may require an update.

## Features

- Tracks current Live versions for:
  - Classic Era
  - Classic TBC / Burning Crusade Anniversary
  - Classic Pandaria
  - Retail
- Detects matching PTR/Test Realm builds whenever available.
- Calculates the WoW **Interface ID** automatically.
- Shows version history and official Blizzard notices from the last 14 days.
- Allows any number of addon names to be assigned to every client.
- Sends desktop notifications and optional SMTP emails.
- Includes affected addon names in patch-change emails.
- Supports separate notification switches for Live and PTR.
- By default, notifies only when the Interface ID changes.
- Can optionally notify for every version or build change.
- Stores the expanded or collapsed news state separately for every client.
- Checks once per day by default; shorter intervals remain selectable.
- Supports custom clients for future WoW versions.
- Displays up to four client cards per page.
- Automatically adjusts the window width to the number of visible cards.
- Runs in the system tray or macOS menu bar.
- Starts with Windows/macOS by default and can be disabled in Settings.
- Fully localized in English and German.
- Provides direct menu links to GitHub and Buy Me a Coffee.
- Encrypts the SMTP password through Electron `safeStorage`.

## Default clients

| Client | Live branch | PTR/Test Realm |
|---|---|---|
| Classic Era | Tracked | When available |
| Classic TBC / Burning Crusade Anniversary | Tracked | When available |
| Classic Pandaria | Tracked | When available |
| Retail | Tracked | When available |

Shared Classic test products are assigned to the correct client by their version family.

## Interface ID

WoW Patch Watch calculates the Interface ID from the first three components of the game version:

```text
Major × 10000 + Minor × 100 + Patch
```

Examples:

| Game version | Interface ID |
|---|---:|
| `1.15.9.68808` | `11509` |
| `2.5.6.68775` | `20506` |
| `5.5.4.68806` | `50504` |
| `12.0.7.68887` | `120007` |

This is the value used in WoW addon TOC files:

```toc
## Interface: 120007
```

It can also be used for interface checks in Lua code.

## Notification behavior

Every client has separate notification switches for:

- **Live – Notify**
- **PTR/Test Realm – Notify**

When a switch is enabled, a relevant update creates a desktop notification. If SMTP delivery is enabled, an email is sent as well.

Patch data, history, and news continue to update even when notifications are disabled.

### Default mode: Interface ID changes only

Small build changes are often not relevant to addon compatibility. The default notification mode therefore triggers only when the calculated Interface ID changes.

```text
12.0.7.68808 → 12.0.7.69000
No notification: Interface ID remains 120007.

12.0.7.69000 → 12.0.8.69100
Notification: Interface ID changes from 120007 to 120008.
```

The notification mode can be changed under **Settings** to notify for every version or build change.

## Addons in email notifications

Addon names assigned to a client are included in change emails:

```text
Retail – PTR/Test Realm

Previous:
12.0.6.x
Interface ID: 120006

New:
12.0.7.x
Interface ID: 120007

Affected addons:
- Swift
- MyProgress
- Achievements Extended
```

If no addon has been assigned, the email explicitly states that no addons are assigned.

## News and fourteen-day history

The **Changes and notices from the last 14 days** section starts expanded for a new client.

Users may open or close it at any time. The state is stored separately for every client and restored after:

- restarting the app,
- refreshing patch data,
- switching pages,
- adding or removing addons.

## Check interval

The default automatic check interval is **daily**.

Available intervals:

- 15 minutes
- 30 minutes
- hourly
- 3 hours
- 6 hours
- 12 hours
- daily

A manual refresh is always available.

## Adding a future WoW client

Open **Clients**, choose **Add new client**, and click the round information icon for an explanation of every field.

A custom client can contain:

- Display name
- Live Battle.net product ID
- Optional Live version prefixes
- Optional PTR/Test Realm product ID
- Optional PTR version prefixes

Examples of product IDs include:

```text
wow
wow_classic
wowt
```

A version prefix can restrict a shared product to a specific version family:

```text
2.5
5.5
12.0
```

Multiple prefixes are separated by commas. An empty prefix field accepts every version returned for that product.

The Interface ID is calculated automatically and is not entered manually.

## Project links and support

- **GitHub repository:** [Dakil001/WoW-Patch-Watch](https://github.com/Dakil001/WoW-Patch-Watch)
- **Support development:** [Buy Me a Coffee – Dakil](https://buymeacoffee.com/dakil)

The application menu contains dedicated **GitHub** and **Buy Me a Coffee** menus that open these pages in the default browser. Bug reports and technical suggestions belong on GitHub. Contributions through Buy Me a Coffee help fund continued maintenance, compatibility work, and new features.

## Installation

### Prebuilt releases

When release files are available, download the appropriate package from the repository's **Releases** section.

Unsigned private builds may trigger Windows SmartScreen or macOS Gatekeeper warnings.

### Requirements for building from source

- Node.js 22 or newer
- npm
- Windows for Windows packaging
- macOS for reliable macOS packaging, signing, and notarization

Clone or download the repository, then install dependencies:

```bash
npm install
```

### Development mode

```bash
npm start
```

### Windows build

Run:

```text
BUILD_WINDOWS.bat
```

or:

```bash
npm run dist:win
```

Generated files are written to `dist`.

Typical outputs:

```text
dist/win-unpacked/WoW Patch Watch.exe
dist/WoW Patch Watch-1.0.7-x64.exe
dist/WoW Patch Watch-1.0.7-arm64.exe
```

The Windows build configuration creates:

- NSIS installer for x64
- NSIS installer for ARM64
- Portable EXE for x64

### macOS build

Run:

```bash
chmod +x BUILD_MAC.command
./BUILD_MAC.command
```

or:

```bash
npm run dist:mac
```

The macOS configuration creates DMG and ZIP packages for:

- Intel Macs (`x64`)
- Apple Silicon (`arm64`)

Public macOS distribution requires an Apple Developer ID, code signing, and notarization.

## Email setup

Open **Settings → Email (SMTP)** and enter:

- SMTP server hostname
- Port
- Direct TLS/SSL setting
- Username
- Password or app password
- Sender address, when required
- Recipient address

Common secure configurations:

| Connection | Port | Direct TLS/SSL |
|---|---:|---|
| STARTTLS | `587` | Off |
| TLS/SSL | `465` | On |

Use **Send test email** before enabling email notifications.

Credentials are not included in the source code. The SMTP password is stored through Electron `safeStorage` using the operating system's credential protection.

## Local data

The application stores settings and history in Electron's standard user-data directory.

### Windows

```text
%APPDATA%\WoW Patch Watch\
```

### macOS

```text
~/Library/Application Support/WoW Patch Watch/
```

The local state includes:

- visible and custom clients,
- assigned addon names,
- Live/PTR notification switches,
- notification mode,
- check interval,
- language,
- news open/closed state,
- current versions and history,
- SMTP configuration.

The SMTP password is stored encrypted when operating-system encryption is available.

## Data sources

WoW Patch Watch uses:

1. Blizzard/Battle.net version data for current client versions.
2. BlizzTrack as a fallback and for recent build history.
3. Official Blizzard News data for notices and hotfix information.

Availability depends on the external services. Not every game branch has a permanently active PTR.

## Language

The application can be switched under **Settings → Language**.

Localized areas include:

- main window,
- client cards,
- settings,
- client management,
- manual-client help,
- native menu bar,
- tray menu,
- status and error messages,
- desktop notifications,
- test emails,
- update emails.

Custom client names and addon names are preserved exactly as entered.

## Tests

Run:

```bash
npm test
```

The test suite checks:

- JavaScript syntax,
- notification rules,
- default values,
- state migration,
- German and English translation completeness,
- persistent news state,
- notification tooltips,
- custom-client help integration,
- native menu configuration.

## Release status

Current project version: **1.0.7**

Important defaults in this release:

- Daily automatic checks
- Notifications only for Interface ID changes
- Start with Windows/macOS enabled
- News state persisted per client
- English and German user interface

See [`CHANGELOG_1.0.7.txt`](CHANGELOG_1.0.7.txt) for the technical change list.

## Limitations

- A future client requires a valid Battle.net product ID.
- A PTR may disappear temporarily or may not exist for a branch.
- General Blizzard News entries are assigned using client-related terms and may not always map perfectly.
- Historical data can be temporarily incomplete if a fallback service is unavailable.
- Unsigned builds may trigger operating-system security warnings.
- Email delivery depends on the SMTP provider and account configuration.

## Privacy and security

- No analytics or telemetry are included.
- Patch information is retrieved from external version and news services.
- Addon names and application settings remain local.
- SMTP credentials are used only for user-configured email delivery.
- The renderer has no direct Node.js or filesystem access.
- The application uses a restricted preload bridge for Electron IPC.

## License

This project is licensed under the [MIT License](LICENSE).

## Disclaimer

WoW Patch Watch is an independent community project and is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment.

World of Warcraft, Warcraft, Battle.net, Blizzard, and related names and logos are trademarks or registered trademarks of Blizzard Entertainment, Inc.

---

<a id="deutsch"></a>

# Deutsch

WoW Patch Watch ist eine plattformübergreifende Desktop-App für Windows und macOS. Sie überwacht aktuelle **World-of-Warcraft-Live- und PTR-/Testrealm-Versionen**, berechnet automatisch die für Addons relevante **Interface-ID**, zeigt Änderungen der letzten 14 Tage und hilft dabei zu erkennen, welche eigenen Addons möglicherweise aktualisiert werden müssen.

## Funktionen

- Überwacht die Live-Versionen von:
  - Classic Era
  - Classic TBC / Burning Crusade Anniversary
  - Classic Pandaria
  - Retail
- Erkennt passende PTR-/Testrealm-Builds, sofern vorhanden.
- Berechnet die WoW-**Interface-ID** automatisch.
- Zeigt Versionsverlauf und offizielle Blizzard-Hinweise der letzten 14 Tage.
- Jedem Client können beliebig viele Addonnamen zugeordnet werden.
- Unterstützt Desktopbenachrichtigungen und optionalen SMTP-E-Mail-Versand.
- Führt betroffene Addons in Patchänderungs-E-Mails auf.
- Bietet getrennte Benachrichtigungsschalter für Live und PTR.
- Benachrichtigt standardmäßig nur bei einer geänderten Interface-ID.
- Kann alternativ bei jeder Versions- oder Buildänderung benachrichtigen.
- Speichert pro Client, ob der Newsbereich geöffnet oder geschlossen ist.
- Prüft standardmäßig täglich; kürzere Intervalle bleiben auswählbar.
- Unterstützt benutzerdefinierte Clients für zukünftige WoW-Versionen.
- Zeigt bis zu vier Clientkacheln pro Seite.
- Passt die Fensterbreite automatisch an die Zahl sichtbarer Kacheln an.
- Kann im Windows-Infobereich beziehungsweise in der macOS-Menüleiste weiterlaufen.
- Startet standardmäßig mit Windows/macOS und kann in den Einstellungen deaktiviert werden.
- Vollständig auf Deutsch und Englisch umschaltbar.
- Bietet direkte Menülinks zu GitHub und Buy Me a Coffee.
- Verschlüsselt das SMTP-Passwort über Electron `safeStorage`.

## Standardmäßig überwachte Clients

| Client | Live-Zweig | PTR/Testrealm |
|---|---|---|
| Classic Era | Wird überwacht | Wenn vorhanden |
| Classic TBC / Burning Crusade Anniversary | Wird überwacht | Wenn vorhanden |
| Classic Pandaria | Wird überwacht | Wenn vorhanden |
| Retail | Wird überwacht | Wenn vorhanden |

Gemeinsam verwendete Classic-Testprodukte werden anhand ihrer Versionsfamilie dem richtigen Client zugeordnet.

## Interface-ID

WoW Patch Watch berechnet die Interface-ID aus den ersten drei Bestandteilen der Spielversion:

```text
Major × 10000 + Minor × 100 + Patch
```

Beispiele:

| Spielversion | Interface-ID |
|---|---:|
| `1.15.9.68808` | `11509` |
| `2.5.6.68775` | `20506` |
| `5.5.4.68806` | `50504` |
| `12.0.7.68887` | `120007` |

Dieser Wert wird in WoW-Addon-TOC-Dateien verwendet:

```toc
## Interface: 120007
```

Er kann außerdem für Interface-Prüfungen im Lua-Code verwendet werden.

## Benachrichtigungsverhalten

Jeder Client besitzt getrennte Benachrichtigungsschalter für:

- **Live – Benachrichtigen**
- **PTR/Testrealm – Benachrichtigen**

Ist ein Schalter aktiviert, erzeugt eine relevante Änderung eine Desktopbenachrichtigung. Ist der SMTP-Versand aktiviert, wird zusätzlich eine E-Mail gesendet.

Patchstand, Verlauf und News werden auch bei deaktivierten Benachrichtigungen weiter aktualisiert.

### Standardmodus: Nur bei geänderter Interface-ID

Kleine Buildänderungen sind für die Addonkompatibilität häufig nicht entscheidend. Standardmäßig wird deshalb nur benachrichtigt, wenn sich die berechnete Interface-ID ändert.

```text
12.0.7.68808 → 12.0.7.69000
Keine Benachrichtigung: Die Interface-ID bleibt 120007.

12.0.7.69000 → 12.0.8.69100
Benachrichtigung: Die Interface-ID wechselt von 120007 auf 120008.
```

Unter **Einstellungen** kann alternativ die Benachrichtigung bei jeder Versions- oder Buildänderung aktiviert werden.

## Addons in E-Mail-Benachrichtigungen

Die einem Client zugeordneten Addonnamen werden in Änderungs-E-Mails aufgeführt:

```text
Retail – PTR/Testrealm

Bisher:
12.0.6.x
Interface-ID: 120006

Neu:
12.0.7.x
Interface-ID: 120007

Betroffene Addons:
- Swift
- MyProgress
- Achievements Extended
```

Ist kein Addon zugeordnet, wird dies in der E-Mail ausdrücklich angegeben.

## News und 14-Tage-Verlauf

Der Bereich **Änderungen und Hinweise der letzten 14 Tage** ist bei einem neuen Client zunächst geöffnet.

Er kann jederzeit geöffnet oder geschlossen werden. Der Zustand wird für jeden Client getrennt gespeichert und wiederhergestellt nach:

- einem Neustart der App,
- einer Aktualisierung der Patchdaten,
- einem Seitenwechsel,
- dem Hinzufügen oder Entfernen von Addons.

## Prüfintervall

Das automatische Standard-Prüfintervall ist **täglich**.

Verfügbare Intervalle:

- 15 Minuten
- 30 Minuten
- stündlich
- 3 Stunden
- 6 Stunden
- 12 Stunden
- täglich

Eine manuelle Aktualisierung ist jederzeit möglich.

## Zukünftigen WoW-Client hinzufügen

**Clients** öffnen, **Neuen Client hinzufügen** auswählen und auf das runde Info-Symbol klicken. Dort werden alle Felder erklärt.

Ein benutzerdefinierter Client kann enthalten:

- Anzeigename
- Live-Battle.net-Produkt-ID
- optionale Live-Versionspräfixe
- optionale PTR-/Testrealm-Produkt-ID
- optionale PTR-Versionspräfixe

Beispiele für Produkt-IDs:

```text
wow
wow_classic
wowt
```

Mit einem Versionspräfix kann ein gemeinsam genutztes Produkt auf eine Versionsfamilie begrenzt werden:

```text
2.5
5.5
12.0
```

Mehrere Präfixe werden durch Kommas getrennt. Ein leeres Präfixfeld akzeptiert jede für das Produkt zurückgegebene Version.

Die Interface-ID wird automatisch berechnet und nicht manuell eingetragen.

## Projektlinks und Unterstützung

- **GitHub-Repository:** [Dakil001/WoW-Patch-Watch](https://github.com/Dakil001/WoW-Patch-Watch)
- **Entwicklung unterstützen:** [Buy Me a Coffee – Dakil](https://buymeacoffee.com/dakil)

Die App-Menüzeile enthält eigene Menüs **GitHub** und **Buy Me a Coffee**, die diese Seiten im Standardbrowser öffnen. Fehlerberichte und technische Vorschläge gehören auf GitHub. Unterstützungen über Buy Me a Coffee helfen bei Pflege, Kompatibilitätsanpassungen und neuen Funktionen.

## Installation

### Fertige Releases

Sobald fertige Pakete bereitgestellt werden, kann die passende Datei im Bereich **Releases** des GitHub-Repositorys heruntergeladen werden.

Nicht signierte private Builds können Warnungen von Windows SmartScreen oder macOS Gatekeeper auslösen.

### Voraussetzungen zum Erstellen aus dem Quellcode

- Node.js 22 oder neuer
- npm
- Windows für Windows-Pakete
- macOS für zuverlässige macOS-Pakete, Signierung und Notarisierung

Repository klonen oder herunterladen und anschließend Abhängigkeiten installieren:

```bash
npm install
```

### Entwicklungsmodus

```bash
npm start
```

### Windows-Build

Ausführen:

```text
BUILD_WINDOWS.bat
```

oder:

```bash
npm run dist:win
```

Die erzeugten Dateien liegen im Ordner `dist`.

Typische Ausgaben:

```text
dist/win-unpacked/WoW Patch Watch.exe
dist/WoW Patch Watch-1.0.7-x64.exe
dist/WoW Patch Watch-1.0.7-arm64.exe
```

Die Windows-Konfiguration erzeugt:

- NSIS-Installer für x64
- NSIS-Installer für ARM64
- portable EXE für x64

### macOS-Build

Ausführen:

```bash
chmod +x BUILD_MAC.command
./BUILD_MAC.command
```

oder:

```bash
npm run dist:mac
```

Die macOS-Konfiguration erzeugt DMG- und ZIP-Pakete für:

- Intel-Macs (`x64`)
- Apple Silicon (`arm64`)

Für eine öffentliche macOS-Verteilung sind eine Apple Developer ID, Codesignierung und Notarisierung erforderlich.

## E-Mail-Einrichtung

Unter **Einstellungen → E-Mail (SMTP)** werden eingetragen:

- SMTP-Servername
- Port
- Einstellung für direktes TLS/SSL
- Benutzername
- Passwort oder App-Passwort
- Absenderadresse, sofern erforderlich
- Empfängeradresse

Übliche sichere Konfigurationen:

| Verbindung | Port | Direktes TLS/SSL |
|---|---:|---|
| STARTTLS | `587` | Aus |
| TLS/SSL | `465` | Ein |

Vor dem Aktivieren der E-Mail-Benachrichtigungen sollte **Test-E-Mail senden** verwendet werden.

Zugangsdaten sind nicht im Quellcode enthalten. Das SMTP-Passwort wird über Electron `safeStorage` mit dem Schutz des Betriebssystems gespeichert.

## Lokale Daten

Die App speichert Einstellungen und Verlauf im normalen Electron-Benutzerdatenordner.

### Windows

```text
%APPDATA%\WoW Patch Watch\
```

### macOS

```text
~/Library/Application Support/WoW Patch Watch/
```

Der lokale Zustand enthält:

- sichtbare und benutzerdefinierte Clients,
- zugeordnete Addonnamen,
- Live-/PTR-Benachrichtigungsschalter,
- Benachrichtigungsmodus,
- Prüfintervall,
- Sprache,
- geöffneten oder geschlossenen Newszustand,
- aktuelle Versionen und Verlauf,
- SMTP-Konfiguration.

Das SMTP-Passwort wird verschlüsselt gespeichert, sofern die Betriebssystemverschlüsselung verfügbar ist.

## Datenquellen

WoW Patch Watch verwendet:

1. Blizzard-/Battle.net-Versionsdaten für aktuelle Clientversionen.
2. BlizzTrack als Fallback und für den jüngsten Buildverlauf.
3. Offizielle Blizzard-Newsdaten für Hinweise und Hotfixinformationen.

Die Verfügbarkeit hängt von den externen Diensten ab. Nicht jeder Spielzweig besitzt dauerhaft einen aktiven PTR.

## Sprache

Unter **Einstellungen → Sprache** kann die App umgeschaltet werden.

Lokalisiert sind:

- Hauptfenster,
- Clientkacheln,
- Einstellungen,
- Clientverwaltung,
- Hilfe zur manuellen Clientanlage,
- native Menüzeile,
- Tray-Menü,
- Status- und Fehlermeldungen,
- Desktopbenachrichtigungen,
- Test-E-Mails,
- Änderungs-E-Mails.

Benutzerdefinierte Clientnamen und Addonnamen bleiben exakt wie eingegeben erhalten.

## Tests

Ausführen:

```bash
npm test
```

Die Tests prüfen:

- JavaScript-Syntax,
- Benachrichtigungsregeln,
- Standardwerte,
- Zustandsmigration,
- Vollständigkeit der deutschen und englischen Übersetzungen,
- dauerhafte Speicherung des Newszustands,
- Benachrichtigungs-Tooltips,
- Hilfe zur manuellen Clientanlage,
- Konfiguration der nativen Menüzeile.

## Versionsstand

Aktueller Projektstand: **1.0.7**

Wichtige Standards dieser Version:

- tägliche automatische Prüfung,
- Benachrichtigung nur bei geänderter Interface-ID,
- Autostart mit Windows/macOS aktiviert,
- Newszustand pro Client gespeichert,
- deutsche und englische Oberfläche.

Die technische Änderungsliste steht in [`CHANGELOG_1.0.7.txt`](CHANGELOG_1.0.7.txt).

## Einschränkungen

- Ein zukünftiger Client benötigt eine gültige Battle.net-Produkt-ID.
- Ein PTR kann vorübergehend verschwinden oder für einen Spielzweig nicht existieren.
- Allgemeine Blizzard-News werden anhand clientbezogener Begriffe zugeordnet und können nicht immer perfekt einsortiert werden.
- Verlaufsdaten können vorübergehend unvollständig sein, wenn ein Fallbackdienst nicht verfügbar ist.
- Nicht signierte Builds können Sicherheitswarnungen des Betriebssystems auslösen.
- Der E-Mail-Versand hängt vom SMTP-Anbieter und der Kontokonfiguration ab.

## Datenschutz und Sicherheit

- Es sind keine Analyse- oder Telemetriedienste enthalten.
- Patchinformationen werden von externen Versions- und Newsdiensten abgerufen.
- Addonnamen und App-Einstellungen bleiben lokal gespeichert.
- SMTP-Zugangsdaten werden ausschließlich für den vom Nutzer konfigurierten E-Mail-Versand verwendet.
- Der Renderer besitzt keinen direkten Node.js- oder Dateisystemzugriff.
- Für Electron-IPC wird eine eingeschränkte Preload-Bridge verwendet.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).

## Hinweis

WoW Patch Watch ist ein unabhängiges Community-Projekt und steht in keiner Verbindung zu Blizzard Entertainment. Es wird weder von Blizzard Entertainment unterstützt noch gesponsert.

World of Warcraft, Warcraft, Battle.net, Blizzard sowie zugehörige Namen und Logos sind Marken oder eingetragene Marken von Blizzard Entertainment, Inc.
