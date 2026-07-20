export const content = `# Verkauf

## Was ist das Verkaufs-Modul

Das Verkaufs-Modul ist deine Zentrale für alle B2B-Bestellungen. Statt Bestellungen aus PDFs abzutippen, ziehst du die Datei rein — Claude Vision liest Kunde, Positionen, Preise und Liefertermin automatisch aus und legt die Bestellung an. Du siehst auf einen Blick, welche Aufträge dringend versendet werden müssen, welche noch offen sind und wo eine Bezahlung fehlt. Für die Buchhaltung exportierst du monatlich alle Umsätze als CSV.

## Was du hier findest

**Dashboard** — vier KPI-Kacheln (offene Bestellungen, dringend, in Verzug, Umsatz diesen Monat) plus Umsatz-Chart und eine Kurzliste der dringendsten Aufträge. Der schnellste Weg, um morgens den Tag zu planen.

**Bestellungen** — die Hauptliste mit zwei Tabs (Offen / Abgeschlossen). Jede Zeile zeigt Bestellnummer, Kunde, kleine Produkt-Kacheln, Liefertermin, Beträge in Netto/Brutto/mit-3%-Skonto und den Status als Ampel (AB, Versand, Rechnung, Bezahlt). Filter nach Suche, Dringlichkeit und Status.

**Kunden** — deine B2B-Kundenkartei mit Firmenname, Kundennummer, Ansprechpartner und Kontaktdaten. Beim Anlegen kannst du Konditionen hinterlegen (Zahlungsziel, Rabatt %, Mindestbestellmenge, Mindestbestellwert) und optional die easybill-Kundennummer verknüpfen. Im Kunden-Detail siehst du die komplette Bestellhistorie und kannst Produkt-Sonderpreise pflegen.

**Import** — Drop-Zone für PDFs, Bilder, .txt oder .eml. Die KI zeigt eine editierbare Vorschau mit einer Zuversichts-Anzeige (grün ab 85%). Alle Felder lassen sich vor dem finalen Speichern noch korrigieren.

**Export** — CSV-Download für einen frei wählbaren Zeitraum, mit Presets für "Dieser Monat", "Letzter Monat", Quartal und Jahr. 24 Spalten inkl. Beträge, Tracking und easybill-Referenzen. Semikolon-getrennt mit BOM — öffnet in Excel direkt korrekt mit Umlauten.

## Häufige Workflows

**Bestellung als bezahlt markieren (der Schnellweg):**
1. Öffne den Reiter Bestellungen.
2. Klicke direkt auf den grauen "Bez."-Punkt in der Status-Spalte.
3. Datum prüfen oder ändern (Default: heute) und "Als bezahlt buchen" klicken.
4. Die Liste aktualisiert sich sofort, kein Reload nötig.

**Neue Bestellung per PDF anlegen:**
1. Klick auf "Import" (oben rechts in der Bestellliste) oder im Menü auf Import.
2. PDF oder Bild in die Drop-Zone ziehen — die KI liest ca. 5-15 Sekunden.
3. Kunden-Zuordnung prüfen: gefundener Kunde wird vorausgewählt, sonst neu anlegen. Positionen und Preise gegenchecken (bei Zuversicht unter 85% besonders sorgfältig).
4. Auf "Bestellung anlegen" klicken — du landest direkt in der neuen Bestellung.

**Kunden-Historie prüfen:**
1. Reiter Kunden öffnen, Firmenname oder Kundennummer suchen.
2. Auf den Kunden klicken für die Detailansicht.
3. Bestellhistorie, hinterlegte Konditionen und Produkt-Sonderpreise durchgehen.
4. Bei Preisverhandlungen: neuen Sonderpreis direkt hier speichern — er greift ab der nächsten Bestellung automatisch.

## Verknüpfungen mit anderen Modulen

**Versand:** Sobald du in einer Bestellung Sendungsdaten erfasst (Paketnummer, Versanddienstleister), wandert die Bestellung in den Tab "Abgeschlossen". Der grüne "Versand"-Punkt in der Statusleiste zeigt an, dass Ware raus ist.

**Rechnungen:** Bestellungen mit hinterlegter easybill-Kundennummer landen dort als Vorlage. Der "Rg."-Punkt in der Statusleiste wird grün, sobald die Rechnung raus ist. Umgekehrt fließen bezahlte Rechnungen zurück in den "Bez."-Status.

**Retouren:** Rücksendungen zu einer Bestellung sind im Retouren-Modul direkt verlinkt. Erstattete Beträge werden dort verbucht und im Kunden-Detail als Historie sichtbar.

## Häufige Fragen

**Warum stimmt der Bruttobetrag mal nicht?** Wenn eine Position keinen Brutto-Wert liefert, rechnet die Liste automatisch Netto × 1,19. Sobald du eine abweichende MwSt. hinterlegst (z.B. 7% für Bücher), wird der echte Wert genommen.

**Was bedeutet "in Verzug" vs. "dringend"?** Dringend = Liefertermin in max. 3 Tagen. In Verzug = Liefertermin ist überschritten und die Bestellung ist noch nicht als versendet markiert.

**Kann ich eine importierte Bestellung nochmal korrigieren?** Ja — nach dem Anlegen landest du im Detail und kannst dort alle Felder bearbeiten. Die Original-PDF bleibt als Quelldokument verknüpft.

**Warum werden manche Positionen mit einem grünen Häkchen und "Match: SKU" angezeigt?** Beim Import gleicht die KI Artikelnummer und EAN mit deiner Produkt-Datenbank ab. Ein Match bedeutet: das Produktbild wird in der Liste angezeigt und Konditionen greifen automatisch.`;
