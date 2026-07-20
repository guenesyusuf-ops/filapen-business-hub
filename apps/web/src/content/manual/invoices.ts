export const content = `# Rechnungen

## Was ist das Rechnungs-Modul
Hier verwaltest du alle Eingangsrechnungen deines Unternehmens — Lieferantenrechnungen, Betriebsausgaben, Belege. Du lädst PDF, JPG oder PNG hoch (bis 25 MB pro Datei), und die KI liest Lieferant, Rechnungsnummer, Rechnungsdatum, Fälligkeit, Beträge, IBAN und Verwendungszweck automatisch aus. Du behältst den Überblick, welche Rechnungen offen, fällig oder überfällig sind, markierst Zahlungen als erledigt und siehst monatlich, wohin dein Geld fließt.

## Was du hier findest

- **Alle:** Die komplette Liste aller nicht archivierten Rechnungen mit Suchfeld, Filtern (Zeitraum, Lieferant, Kategorie, Betrag) und Sortierung nach jeder Spalte.
- **Offen:** Alle Rechnungen, die noch nicht als bezahlt markiert sind — unabhängig vom Fälligkeitsdatum.
- **Bald fällig:** Rechnungen, deren Zahlungsziel in den nächsten Tagen ansteht. Warnfarbe orange.
- **Heute fällig:** Rechnungen, die exakt heute bezahlt werden müssen.
- **Überfällig:** Rechnungen, deren Fälligkeit bereits verstrichen ist, ohne dass eine Zahlung erfasst wurde. Rot markiert.
- **Bezahlt:** Rechnungen, für die eine Zahlung eingetragen wurde. Bleibt als Historie erhalten.
- **Lieferanten:** Übersicht aller Firmen mit Kacheln je Lieferant — Gesamtausgaben, offener Betrag, Anzahl Rechnungen, letzte Rechnung, letzte Zahlung. Sortierbar und suchbar.
- **Archiv:** Ausgeblendete Rechnungen, die aus der Hauptliste raus sind, aber jederzeit wiederhergestellt oder endgültig gelöscht werden können.
- **Statistik:** KPI-Kacheln, Liquiditäts-Widget (nächste 7 und 30 Tage), Monatsbalken der letzten 12 Monate (grün bezahlt, orange offen), Ausgaben nach Kategorie und Top-Lieferanten.
- **Einstellungen:** Erinnerungs-Schwellen, zusätzliche E-Mail-Empfänger, eigene Kategorien und Aufbewahrungsfrist (Standard 120 Monate für GoBD).

## Häufige Workflows

### Workflow 1: Rechnung hochladen und OCR prüfen
1. Klicke oben rechts auf *Rechnung hochladen*.
2. Ziehe eine oder mehrere Dateien in das gestrichelte Feld oder klicke, um sie auszuwählen. Mehrere gleichzeitig sind möglich.
3. Warte kurz, bis der Status auf *Erstellt — öffnen* wechselt, und klicke auf den Link.
4. In der Detailansicht prüfst du, ob Lieferant, Nummer, Datum, Fälligkeit und Betrag stimmen. Bei kleinen Fehlern korrigierst du direkt im Feld.
5. Optional Kategorie zuweisen, dann Fenster schließen — die Rechnung ist in der Liste unter *Offen* sichtbar.

### Workflow 2: Rechnung als bezahlt markieren
1. Öffne die Zeile in der Tabelle (Klick auf die Rechnung) oder nutze das Häkchen-Symbol am Zeilenende.
2. Trage das Zahldatum ein — Standard ist heute.
3. Wähle das Zahlungskonto, falls du mehrere hinterlegt hast.
4. Bestätige mit *Bezahlt markieren*. Die Rechnung wandert automatisch in den Tab *Bezahlt* und die Zähler oben aktualisieren sich.

### Workflow 3: Überfällige Rechnungen abarbeiten
1. Wechsle auf den Tab *Überfällig* — die Zahl neben dem Tab zeigt dir sofort, wie viele es sind.
2. Sortiere nach Fälligkeit, damit die ältesten oben stehen.
3. Kläre pro Rechnung, ob sie wirklich noch offen ist: prüfe die Bankbewegung oder frag den Lieferanten.
4. Ist bereits gezahlt worden, markiere sie über den Bezahlt-Dialog mit dem tatsächlichen Zahldatum.
5. Ist die Zahlung noch offen, plane sie ein und lade sie danach über den Workflow 2 nach.

## Verknüpfungen mit anderen Modulen
- **Einkauf:** Wenn du eine Bestellung im Einkaufs-Modul angelegt hast, kannst du die zugehörige Eingangsrechnung hier hochladen und beide später gegeneinander abgleichen. Lieferant und Beträge lassen sich verknüpfen.
- **Finanz-Hub:** Bezahlte Rechnungen und offene Verbindlichkeiten fließen als Ausgaben in die Auswertungen des Finanz-Hubs ein. Die Kategorien aus den Einstellungen sind dieselben wie in den Ausgaben-Berichten.
- **Dokumente:** Die hochgeladene Original-PDF wird als Beleg in der Rechnungs-Detailansicht verlinkt und kann bei Bedarf ins Dokumente-Modul verschoben oder von dort verlinkt werden.

## Häufige Fragen

### Was passiert, wenn die KI ein Feld falsch erkennt?
Öffne die Rechnung und klicke direkt in das Feld — Betrag, Datum oder Lieferant lassen sich manuell überschreiben. Deine Korrektur überschreibt den OCR-Wert, das Original-PDF bleibt unverändert. Wenn die OCR fehlschlägt (rotes Label *OCR fehlgeschlagen*), trägst du alle Felder von Hand nach.

### Wann bekomme ich Erinnerungen für offene Rechnungen?
Standardmäßig 7 Tage, 3 Tage und am Fälligkeitstag selbst — jeweils morgens um 07:30 per E-Mail an dich als Uploader. In den Einstellungen wählst du weitere Schwellen (bis 14 Tage vor oder 7 Tage nach Fälligkeit) und trägst zusätzliche Empfänger ein, etwa deine Buchhaltung.

### Werden archivierte oder gelöschte Rechnungen wirklich weg sein?
Archiviert heißt nur ausgeblendet — im Archiv-Tab kannst du sie jederzeit wiederherstellen. Erst *Endgültig löschen* entfernt Datei und Metadaten unwiderruflich. Beachte die Aufbewahrungsfrist: In Deutschland gilt GoBD mit 10 Jahren, deshalb steht der Standardwert auf 120 Monate.

### Kann ich mehrere Rechnungen auf einmal bearbeiten?
Ja. Setze in der Tabelle links Häkchen bei allen Rechnungen, die du bearbeiten willst — oben erscheint ein Balken mit der Anzahl der ausgewählten und dem Button *Archivieren*. Weitere Aktionen pro Zeile führst du über die Symbole am Zeilenende aus, die beim Überfahren mit der Maus sichtbar werden.`;
