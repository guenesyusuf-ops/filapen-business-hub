# Filapen — Session Resume

Diese Datei ist fuer Claude (mich), nicht fuer dich. Wenn du eine neue
Session startest, kopier den Inhalt zwischen den Linien unten und gib
ihn als erste Nachricht ein. Ich befolge ihn dann strikt.

---

Wir machen weiter wo wir aufgehört haben. Bevor du irgendetwas tust:

1. Lies vollständig:
   `/Users/yumaya/.claude/projects/-Users-yumaya-filapen/memory/MEMORY.md`

2. Lies dann jedes referenzierte Memory-File darunter, besonders:
   - `feedback_never_break_nfc_codes.md` (HEILIGE REGEL)
   - `nfc4you_module_live.md`
   - `doc_share_links_live.md`
   - `feedback_always_push_after_backend.md`

3. Führe aus:
   ```bash
   cd /Users/yumaya/filapen && git log --oneline -15
   ```

4. Mache einen NFC-Smoke-Test:
   ```bash
   curl -s -o /dev/null -w "NFC: HTTP %{http_code}\n" \
     https://filapenapi-production.up.railway.app/api/nfc/public/8vbcdo
   ```
   Erwartet: HTTP 200. Falls nicht 200 → STOPP und mir Bescheid geben.

5. Gib mir dann einen Status-Überblick:
   - Was waren die letzten 5 Commits über?
   - Welche Memory-Regeln muss ich kennen?
   - Welche Module sind live (NFC, Doc-Share, Sales-Brutto, AI-Admin etc.)?
   - Gibt es offene Punkte aus den letzten Sessions?

6. Warte dann auf meine nächste Anweisung. Mach NICHTS auf Verdacht.

Wichtigste Regeln (aus Memory):
- **NFC-Code-Pfad ist Hardware-kritisch** — vor und nach JEDER NFC-Änderung Smoke-Test mit `8vbcdo`. Existierende physische Bänder dürfen NIEMALS unbrauchbar werden.
- Nach Backend-Änderungen IMMER sofort committen + pushen (Railway deployt auf push)
- Bei Unsicherheit fragen, nicht handeln
- Desktop-Look unverändert lassen bei Mobile-Optimierungen

---

## Status zum Zeitpunkt der letzten Session

**Live in Production:**
- NFC4you-Modul (Hub + nfc4you.de Public-Frontend, ~3000 Codes in DB)
- Doc-Share-Links (extern teilen mit Ablaufdatum + Vorschau)
- Sales-Orders Brutto + Skonto + Quick-Paid-Badge + Auto-Refresh
- KI-Assistent mit Admin-Rechten in allen Modulen + General-Knowledge
- Taschenrechner-Tab + Paper-Design auf allen 3 Rechnern (Home)
- Mobile-Polish-Pass abgeschlossen

**Wichtige URLs:**
- Hub: deine Vercel-Domain
- Public NFC: https://nfc4you.de/{code}
- API: https://filapenapi-production.up.railway.app
- DB: Supabase Project `adzeokkmrnzhresrtejs` (Financial Hub)

**Repo:** https://github.com/guenesyusuf-ops/filapen-business-hub

**Branch:** `main` (immer direkt darauf gearbeitet, keine PRs)
