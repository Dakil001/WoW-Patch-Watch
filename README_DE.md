# WoW Patch Watch 1.0.5

Desktop-App für Windows und macOS zur Überwachung der aktuellen WoW-Live- und PTR-/Testrealm-Versionen sowie der möglichen Auswirkungen auf die eigenen Addons.

## Neu in Version 1.0.5

- Die Beschriftung **„melden“** wurde in allen Clientkarten durch **„Benachrichtigen“** ersetzt.
- Die App ist vollständig auf **Deutsch und Englisch** umschaltbar.
- Die Spracheinstellung befindet sich unter **Einstellungen → Sprache**.
- Ein Sprachwechsel wird sofort auf folgende Bereiche angewendet:
  - Hauptfenster und Clientkarten
  - Einstellungen und Clientverwaltung
  - native Menüzeile unter Windows und macOS
  - Tray-/Infobereich-Menü
  - Status-, Fehler- und Bestätigungsmeldungen
  - Desktop-Benachrichtigungen
  - Test-E-Mails und Patchänderungs-E-Mails
- In englischer Sprache werden bevorzugt englische Blizzard-News geladen; in deutscher Sprache werden bevorzugt deutsche Blizzard-News geladen.
- Datums- und Zeitangaben verwenden das passende deutsche beziehungsweise englische Format.
- Beim Aktualisieren von 1.0.4 bleibt für vorhandene Installationen zunächst **Deutsch** eingestellt. Alle vorhandenen Daten bleiben erhalten.

## Standardmäßig überwachte Clients

- Classic Era
- Classic TBC / Burning Crusade Anniversary
- Classic Pandaria
- Retail
- die jeweils passenden PTR-/Testrealm-Produkte, sofern ein kompatibler Build vorhanden ist

## Hauptfunktionen

- Aktueller Patchstand je Live-Version
- Automatisch berechnete WoW-Interface-ID für TOC- und Lua-Prüfungen
- Passender PTR-/Testrealm-Build mit Kennzeichnung, ob er neuer als Live ist
- Buildhistorie und offizielle Blizzard-Hinweise der letzten 14 Tage
- Zuordnung beliebig vieler Addonnamen zu jedem Client
- Optionale Benachrichtigung je Client getrennt für Live und PTR
- Desktop-Benachrichtigung und optionaler SMTP-E-Mail-Versand
- Die Änderungs-E-Mail führt die dem Client zugeordneten Addons auf
- Clientverwaltung zum Ein-/Ausblenden, Hinzufügen, Bearbeiten und Löschen benutzerdefinierter Clients
- Maximal vier Clientkarten pro Seite
- Variable Fensterbreite passend zur Zahl der sichtbaren Karten auf der aktuellen Seite
- Hintergrundbetrieb und optionaler Autostart
- Verschlüsselte Speicherung des SMTP-Passworts über Electrons `safeStorage`

## Sprache ändern

1. **Einstellungen** öffnen.
2. Im Feld **Sprache** zwischen **Deutsch** und **Englisch** wählen.
3. **Speichern** anklicken.

Die Auswahl wird dauerhaft in der lokalen `state.json` gespeichert. Die native Menüzeile und das Tray-Menü werden ebenfalls direkt neu aufgebaut. Nach einem Sprachwechsel lädt die App die Blizzard-News erneut in der bevorzugten Sprache.

## Benachrichtigungen pro Client

Jede Clientkarte enthält getrennte Kästchen für:

- **Live – Benachrichtigen**
- **PTR / Testrealm – Benachrichtigen**

Ist ein Kästchen aktiviert, löst eine neu erkannte Änderung dieses Kanals eine Desktop-Benachrichtigung aus. Ist der E-Mail-Versand eingerichtet und aktiviert, wird zusätzlich eine E-Mail verschickt. Die Abfrage, Anzeige und Speicherung des Verlaufs laufen auch bei deaktiviertem Kästchen weiter.

## Addons in Änderungs-E-Mails

Die unter **Zugeordnete Addons** eingetragenen Namen werden in der Änderungs-E-Mail ausdrücklich aufgeführt.

Deutsch:

```text
Retail – PTR/Testrealm
Bisher: 12.0.6.x (Build ..., Interface-ID 120006)
Neu: 12.0.7.x (Build ..., Interface-ID 120007)

Betroffene Addons:
- Swift
- MyProgress
```

Englisch:

```text
Retail – PTR/Test realm
Previous: 12.0.6.x (Build ..., Interface ID 120006)
New: 12.0.7.x (Build ..., Interface ID 120007)

Affected addons:
- Swift
- MyProgress
```

## Zusätzlichen WoW-Client anlegen

Über **Clients → Neuen Client hinzufügen** können zukünftige WoW-Versionen ergänzt werden.

Erforderlich:

1. **Anzeigename**
2. **Live-Client-ID** als Battle.net-Produktname

Optional:

- Live-Versionspräfixe
- PTR-Client-ID
- PTR-Versionspräfixe

Mehrere Präfixe werden durch Kommas getrennt:

```text
7.3, 7.4
```

Bleibt ein Präfixfeld leer, akzeptiert die App jede Version des betreffenden Produkts.

## Interface-ID

Die Interface-ID wird aus den ersten drei Bestandteilen der Clientversion berechnet:

```text
Major × 10000 + Minor × 100 + Patch
```

Beispiele:

- `1.15.9.68808` → `11509`
- `2.5.6.68775` → `20506`
- `5.5.4.68806` → `50504`
- `12.0.7.68887` → `120007`

Sie entspricht dem Wert hinter `## Interface:` in einer WoW-TOC-Datei und kann auch bei Interface-Prüfungen im Lua-Code verwendet werden.

## E-Mail-Einstellungen

Unter **Einstellungen → E-Mail (SMTP)** werden SMTP-Server, Port, Verschlüsselung, Benutzer, Passwort beziehungsweise App-Passwort und Empfänger eingetragen.

Für mail.de:

| Feld | Wert |
|---|---|
| SMTP-Server | `smtp.mail.de` |
| Port | `587` |
| Direktes TLS/SSL | ausgeschaltet; STARTTLS wird verwendet |
| Alternative | Port `465` mit eingeschaltetem direktem TLS/SSL |

Danach **Test-E-Mail senden** ausführen.

## Windows-EXE erstellen

Voraussetzungen:

- Node.js 22 oder neuer
- npm

Vorgehen:

1. Das Quellpaket vollständig entpacken.
2. `BUILD_WINDOWS.bat` starten.
3. Die fertigen Dateien liegen anschließend unter `dist`.

Direkt ausführbare App:

```text
dist\win-unpacked\WoW Patch Watch.exe
```

Zusätzlich werden ein NSIS-Installer und eine portable x64-EXE erstellt.

## macOS-Pakete erstellen

Auf einem Mac:

```bash
npm install
npm run dist:mac
```

Erstellt werden DMG- und ZIP-Ausgaben für Intel (`x64`) und Apple Silicon (`arm64`). Für eine öffentliche Verteilung sind Codesignierung und Notarisierung erforderlich.

## Aktualisierung von 1.0.4

App-ID und Benutzerdatenordner bleiben unverändert. Erhalten bleiben:

- sichtbare und benutzerdefinierte Clients
- Addonzuordnungen
- Benachrichtigungsschalter
- SMTP-Einstellungen und verschlüsseltes Passwort
- aktuelle Buildstände, Historie und News

Die vorhandene Zustandsdatei wird beim ersten Start auf Schema 4 erweitert und erhält die Einstellung `language: "de"`.

Speicherorte:

- Windows: `%APPDATA%\WoW Patch Watch\`
- macOS: `~/Library/Application Support/WoW Patch Watch/`

## Datenquellen

1. Blizzard-Versionsdienst des Battle.net Launchers
2. BlizzTrack als Fallback und für die 14-Tage-Historie
3. JSON-News-Schnittstelle der offiziellen Blizzard-Newsseite

## Grenzen

- Für einen neuen Client muss die passende Battle.net-Produkt-ID bekannt sein.
- Nicht jeder Spielezweig besitzt dauerhaft einen aktiven PTR.
- Die automatische Zuordnung allgemeiner Blizzard-News ist auf die bekannten Standardclients ausgerichtet.
- Die erzeugten privaten Windows- und macOS-Builds sind ohne eigene Zertifikate nicht digital signiert.
