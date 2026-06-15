# NFC4you Public Frontend

Öffentliches Frontend für `nfc4you.de` — getrennt vom Filapen Business Hub.

## Routen

| Pfad | Zweck |
|---|---|
| `/` | Landing-Page (Werbung für die Bänder) |
| `/[code]` | Auto-Routing nach Status (active → /help, inactive → /activate) |
| `/[code]/activate` | Aktivierungs-Formular (alle Felder optional + PIN + Consent) |
| `/[code]/help` | Profil-Seite für Finder mit großem Anruf-Button |
| `/[code]/edit` | PIN-geschützter Edit/Delete-Bereich |
| `/impressum` `/datenschutz` `/agb` | Legal-Slots (Texte vom Anwalt einsetzen) |

## NFC-Tag-Programmierung

NFC-Tags werden mit folgender URL programmiert:
```
https://nfc4you.de/{code}
```
Beispiel: `https://nfc4you.de/k653r`

Das `/activate` und `/help` ergibt sich aus dem Status auf dem Server —
der NFC-Tag selbst kennt nur die Basis-URL.

## Environment

```
NEXT_PUBLIC_API_URL=https://api.filapen.com
```

## Deployment (Vercel)

1. Eigenes Vercel-Projekt anlegen, Root-Verzeichnis: `apps/nfc-public`
2. Build-Command: `cd ../.. && npm install && npm run build:nfc-public`
3. Output-Verzeichnis: `apps/nfc-public/.next`
4. Domain `nfc4you.de` zuweisen
5. Env `NEXT_PUBLIC_API_URL` auf die Railway-API-URL setzen

## Legal

Die Inhalte in `/impressum`, `/datenschutz`, `/agb` sind Platzhalter
und müssen vor dem Live-Gang durch deinen Anwalt finalisiert werden.
