export const content = `# Einkauf

## Was ist das Einkaufs-Modul

Hier verwaltest du alles rund um deine Wareneinkäufe: Lieferanten, Bestellungen, Rechnungen, Zahlungen und den Wareneingang. Das Modul ersetzt Excel-Listen und E-Mail-Ordner. Du siehst auf einen Blick, wie viel Geld offen ist, welche Bestellungen unterwegs sind und welche Rechnungen überfällig werden. Am Monatsende exportierst du alles in einem Rutsch für den Steuerberater — inklusive DATEV-Format und Kontenrahmen SKR03 oder SKR04.

## Was du hier findest

**Übersicht:** Startseite mit KPI-Kacheln (Bestellungen gesamt, offen, bezahlt) für den gewählten Zeitraum, überfälligen Rechnungen und deinen Top-Lieferanten. Über die Kacheln springst du direkt gefiltert in die Bestellliste.

**Bestellungen:** Die vollständige Liste aller Einkäufe mit Filter nach Zahlungsstatus, Status, Lieferant, Zeitraum und "Unterwegs". Über "Neue Bestellung" legst du neue Einkäufe an, klickst auf eine Zeile für Details, Rechnungen, Sendungen und Zahlungen.

**Lieferanten:** Stammdaten deiner Lieferanten mit Firma, Ansprechpartner, Adresse, USt-ID, Bankverbindung, Standardwährung und Zahlungsziel. Neue Bestellungen greifen automatisch auf diese Daten zu.

**Export:** CSV-Downloads für die Buchhaltung — Steuerberater-Export, DATEV-Buchungsstapel, Offene Posten, Zahlungen und mehr. Mit Vorschau, Zeitraum-Filter und SKR-Auswahl.

## Häufige Workflows

**Neue Bestellung anlegen und Rechnung erfassen**
1. Klicke oben rechts auf "Neue Bestellung"
2. Wähle den Lieferanten (oder lege einen neuen an) — Währung wird automatisch übernommen
3. Füge Positionen hinzu: Produktname, Menge, Einzelpreis, MwSt.-Satz
4. Trage optional Versand- und Zollkosten sowie Notizen ein
5. Rechnungsnummer und -datum unten mit erfassen und speichern — Bestellung und Rechnung sind in einem Schritt angelegt

**Wareneingang buchen**
1. Öffne die Bestellung aus der Liste
2. Klicke auf "Bestellung angekommen" und trage das Ankunftsdatum ein
3. Wenn du mit Sendungen arbeitest: "Sendung" anlegen, Sendungsnummer und Carrier eintragen
4. Bei Ankunft der Sendung "Als angekommen markieren" — Mengen werden auf die Positionen gebucht
5. Der Status springt automatisch auf "Angekommen"

**Zahlung erfassen und Monatsabschluss exportieren**
1. Öffne die Bestellung und klicke rechts bei "Zahlungen" auf Hinzufügen
2. Trage Betrag, Datum und Zahlungsart ein (Überweisung, Kreditkarte, PayPal usw.) — Teilzahlungen sind möglich, der offene Betrag reduziert sich automatisch
3. Wechsle am Monatsende auf "Export"
4. Wähle den Zeitraum (z. B. "Letzter Monat") und dein Kontenrahmen (SKR03 oder SKR04)
5. Klicke beim "Steuerberater-Export" oder "DATEV-Buchungsstapel" auf "CSV laden" und schicke die Datei an deinen Steuerberater

## Verknüpfungen mit anderen Modulen

Bestellpositionen kannst du mit Produkten aus deinem Sortiment verknüpfen — das erleichtert später Auswertungen zu Einkaufspreisen und Margen. Die im Einkauf erfassten Zahlungen und Rechnungen fließen ins Finanzen-Modul ein, wo du sie zusammen mit Verkäufen und anderen Ausgaben siehst. Wareneingänge sind die Grundlage für dein Lager und beeinflussen später auch das Retouren-Modul, wenn du Ware an den Lieferanten zurückschickst. Die Lieferanten-Stammdaten (IBAN, USt-ID, Zahlungsziel) werden auch für automatische Überweisungsvorschläge und Reminder genutzt.

## Häufige Fragen

**Kann ich eine Bestellung in USD anlegen, obwohl ich in EUR buchhalte?**
Ja. Wähle beim Anlegen die Währung USD und trage bei Bedarf den Wechselkurs ein. Im Export werden beide Beträge ausgewiesen und der Steuerberater bekommt die EUR-Werte für die Buchhaltung.

**Was passiert, wenn eine Rechnung nur teilweise bezahlt wurde?**
Erfasse einfach die tatsächlich überwiesene Summe als Zahlung. Der Zahlungsstatus wechselt auf "Teilweise bezahlt", der offene Restbetrag bleibt sichtbar und taucht in der KPI-Kachel "Teilweise Bezahlt" sowie im "Offene Posten"-Export auf.

**Kann ich eine Bestellung nachträglich ändern oder stornieren?**
Ja. Auf der Detailseite gibt es "Bearbeiten" (nur der Ersteller oder Admin/Owner) und "Stornieren". Stornierte Bestellungen sind standardmäßig ausgeblendet, du kannst sie über den Filter "Stornierte anzeigen" oder "Nur stornierte" wieder einblenden.

**Was ist der Unterschied zwischen Steuerberater-Export und DATEV-Export?**
Der Steuerberater-Export ist eine breite Excel-freundliche CSV mit allen kaufmännisch relevanten Spalten plus Kontenvorschlag — ideal, wenn dein Steuerberater manuell arbeitet. Der DATEV-Buchungsstapel ist ein schmales Format, das direkt in DATEV oder Lexware importiert werden kann.`;
