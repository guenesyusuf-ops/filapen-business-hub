# Content Generator — OpenAI / ChatGPT Integration

## Überblick

Der Content-Generator (Finance Hub → Content → Generieren) kann ab sofort über OpenAI (ChatGPT) ODER Anthropic (Claude) laufen. Die Umschaltung erfolgt rein über Environment-Variablen ohne Code-Änderung.

## Provider-Auswahl

Die Reihenfolge der Auswahl im Service:

1. `CONTENT_AI_PROVIDER=openai` oder `=anthropic` → explizit erzwungen
2. `OPENAI_API_KEY` gesetzt → OpenAI
3. `ANTHROPIC_API_KEY` gesetzt → Anthropic
4. Weder noch → Fallback auf die interne Template-Engine

## OpenAI aktivieren (Minimal-Setup)

In Railway beim API-Service unter **Variables** setzen:

```
OPENAI_API_KEY=sk-proj-xxx...
```

Das reicht bereits — ab dem nächsten Deploy läuft Generierung über OpenAI. Optional:

```
OPENAI_MODEL=gpt-4o          # default, alternativ gpt-4o-mini, gpt-4-turbo
CONTENT_AI_PROVIDER=openai   # explizit, falls auch Anthropic-Key gesetzt ist
```

## Wo den Key bekommen

https://platform.openai.com/api-keys → **Create new secret key**. Kopie sofort sichern, der Key wird nur einmal gezeigt.

## Sicherheit

- Key **NICHT** in Frontend-Code, **NICHT** in Commits, **NICHT** in Logs
- Der Key wird ausschließlich im Backend (`apps/api`) verwendet — Frontend schickt Requests an `/api/content/generate`, der Backend ruft OpenAI auf
- Railway speichert Environment-Variablen verschlüsselt

## Request-Shape (was das Backend an OpenAI schickt)

```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer $OPENAI_API_KEY
Content-Type: application/json

{
  "model": "gpt-4o",
  "max_tokens": 4000,
  "temperature": 0.8,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<Performance-Copywriter System-Prompt>" },
    { "role": "user", "content": "<Produktdaten + Anforderungen>" }
  ]
}
```

`response_format: json_object` zwingt das Modell zu gültigem JSON — spart Parsing-Fehler.

## Fehlerhandling

- 429 (Rate limit) / 500 / Netzwerkfehler → `null` zurückgeben → Template-Engine übernimmt transparent
- Leere Antwort → gleicher Fallback
- JSON-Parse-Fehler → rohe Text-Antwort wird als einzelner `primaryTexts`-Eintrag zurückgegeben damit der User zumindest was sieht

Alle Fehler landen mit Status-Code + erste 400 Zeichen Body im Railway-Log (`[AiGeneratorService] OpenAI 429: ...`).

## Kosten-Kontrolle

- `max_tokens=4000` limitiert pro Request
- Empfohlenes Default-Modell: `gpt-4o` (~$2.50 input / $10 output pro 1M Tokens)
- Günstigere Alternative: `OPENAI_MODEL=gpt-4o-mini` (~$0.15 input / $0.60 output pro 1M Tokens)

Ein typischer Generation-Request ≈ 800 Input + 2000 Output Tokens → ca. $0.02 mit gpt-4o, $0.001 mit gpt-4o-mini.

## Rückkehr zu Anthropic / Claude

Einfach `OPENAI_API_KEY` aus Railway entfernen oder `CONTENT_AI_PROVIDER=anthropic` setzen. Anthropic-Key muss weiterhin vorhanden sein.

## Betroffene Dateien (für Code-Review)

- `apps/api/src/modules/content/ai-generator.service.ts` — Provider-Logik, OpenAI-Call, Fallback
- `apps/api/src/modules/content/content.controller.ts` — unverändert
- Frontend (Finance → Content) — unverändert, greift bereits auf Backend-Endpoint zu

## Testen

1. OPENAI_API_KEY setzen, Redeploy abwarten
2. Railway-Log checken: sollte `Content-AI provider: openai` beim Start zeigen
3. Content Hub → Content generieren → generierte Copy prüfen
4. Bei Fehler: Log-Zeile `[AiGeneratorService] OpenAI ...` gibt Status-Code + Fehlergrund
