export const content = `# Finance Hub

## Was ist der Finance Hub
Der Finance Hub bündelt alle Zahlen zu Umsatz, Kosten und Gewinn aus deinen Verkaufs- und Werbekanälen an einem Ort. Statt zwischen Shopify, Amazon und Ads-Konten hin und her zu springen, siehst du hier die Gesamtperformance und kannst gezielt in einzelne Kanäle, Kampagnen und Produkte reinzoomen.

## Was du hier findest

- **Übersicht:** Startseite mit KPIs (Umsatz, Gewinn, Bestellungen, Ø Warenkorb), einer Gewinn-und-Verlust-Wasserfallgrafik, Umsatzverlauf und Kanal-Karten für Shopify plus Amazon. Zeitraum und Kanal wählst du oben rechts.
- **Produkte:** Katalog aller aus Shopify synchronisierten Produkte mit Suche (Titel, SKU, EAN, Marke), Sortierung nach Name, Preis oder Neuestem. Kachelansicht mit Bild, Preis, Varianten und Lagerbestand. Klick öffnet die Produkt-Detailseite.
- **Kosten:** Zentrale Stelle für Zahlungsgebühren (Anbieter, prozentuale und fixe Gebühr pro Transaktion), Fixkosten (Software, Gehalt, Lager, Agentur, Creator, Kredit, Steuerberater) mit Häufigkeit (monatlich, wöchentlich, quartalsweise, jährlich, einmalig) und Versandregeln (in Vorbereitung).
- **Kampagnen:** Liste aller Werbekampagnen aus Meta und Google mit Ausgaben, Umsatz, ROAS, Conversions, CPA und Status. Filter nach Plattform, KPI-Zusammenfassung oben.
- **Attribution:** Zeigt, welcher Kanal wie viel zu deinem Umsatz beiträgt. Modelle wählbar (Linear, Last Touch, Time Decay, Data Driven). Balken- und Treemap-Grafiken plus Empfehlungen.
- **Kohorten & LTV:** Heatmap der Wiederkaufsraten pro Kundenkohorte (Monat für Monat) und Lifetime-Value nach Segmenten. Zeigt dir, wie treu deine Kundschaft ist.
- **Benchmarks:** Vergleich deiner Kennzahlen mit Branchendurchschnitt und Top-25-Prozent. Radar-Chart und Karten mit Perzentil-Balken zeigen, wo du stark bist und wo Handlungsbedarf besteht.
- **Creative-Analyse:** Deep-Dive in einzelne Kampagnen mit ROAS-Trends über die Zeit, Spend-Efficiency-Scatterplot und Trend-Kennzeichnung (steigend, stabil, fallend).
- **Profitabilität:** Rechner pro Produkt. Trage Einkaufspreis, Zoll, Fracht, Verkaufspreis, MwSt, Payment-Gebühr und optional Werbekosten ein. Ergebnis: Marge und Gewinn pro Stück. Modelle lassen sich speichern, duplizieren und vergleichen.
- **Reports:** Generierung von Gewinn- und Verlustrechnung, Produkt-Report und Kanal-Report als CSV oder PDF für einen frei wählbaren Zeitraum. Automatisierter Versand ist in Vorbereitung.
- **Integrationen:** Verbindungen zu Shopify, Meta Ads, Google Ads, TikTok Ads und Amazon anlegen, manuell synchronisieren oder trennen. Zeigt Status und letzten Sync.
- **Channels (Shopify, Amazon):** Kanal-spezifische Detailansicht mit eigenen KPIs, Bestellliste und Marktplatz-Aufschlüsselung (bei Amazon: DE, FR, IT, ES, UK und weitere).

## Häufige Workflows

### Workflow 1: Wöchentlicher Umsatz-Check
1. Öffne die Übersicht.
2. Stelle oben rechts den Zeitraum auf die letzten sieben Tage.
3. Prüfe die KPI-Karten: Umsatz, Gewinn, Bestellungen und Ø Warenkorb im Vergleich zur Vorwoche.
4. Schau in die Kanal-Karten, welcher Kanal getragen hat (Shopify vs. Amazon).
5. Bei Auffälligkeiten klicke auf den Kanalnamen, um in die Detailansicht zu springen.

### Workflow 2: Kosten einer neuen Kampagne oder Software erfassen
1. Öffne den Reiter *Kosten*.
2. Wechsle auf den Tab *Fixkosten* und klicke auf *Fixkosten hinzufügen*.
3. Trage Name, Betrag, Währung, Häufigkeit und Kategorie ein und setze das Startdatum.
4. Bei einmaligen Ausgaben Enddatum leer lassen, bei Verträgen Enddatum eintragen.
5. Speichern. Die monatliche Summe oben aktualisiert sich sofort und fließt in die Gewinnrechnung ein.

### Workflow 3: Attribution und ROAS prüfen
1. Öffne *Kampagnen* und filtere auf die Plattform, die dich interessiert.
2. Notiere dir die Blended-ROAS-Kennzahl oben.
3. Wechsle zu *Attribution* und wähle ein Modell (Start: Linear, für konservativere Sicht Last Touch).
4. Vergleiche in der Balkengrafik, welche Kanäle den Umsatz wirklich anschieben.
5. Bei niedriger ROAS in einer Kampagne wechsle zur *Creative-Analyse* und schau, ob der Trend fällt oder ob nur ein Ausreißer vorliegt.

### Workflow 4: Neuen Verkaufskanal anbinden
1. Öffne *Integrationen*.
2. Wähle die Plattform (aktuell live: Shopify; weitere in Vorbereitung).
3. Folge dem OAuth-Flow der Plattform und autorisiere Filapen.
4. Nach Rückkehr zeigt die Karte den Verbindungsstatus. Klick auf *Sync*, um den ersten Datenimport anzustoßen.
5. Prüfe später unter *Übersicht* oder im Kanal-Tab, ob Bestellungen und Umsatz erscheinen.

### Workflow 5: Profitabilität eines Produkts durchrechnen
1. Öffne *Profitabilität* und klicke auf *Neue Berechnung*.
2. Trage Produktname, Einkaufspreis, Frachtkosten, Zollsatz, Verkaufspreis, MwSt-Satz, Versand an Kunde und Payment-Gebühr ein.
3. Optional: Werbekosten pro Stück ergänzen.
4. Speichere die Berechnung. Marge und Gewinn siehst du sofort auf der Karte.
5. Für Szenarien: Berechnung duplizieren und Preise oder Kosten anpassen. Grüne Karten sind profitabel, gelbe knapp, rote verlustig.

## Verknüpfungen mit anderen Modulen
- **Produkte und Bestellungen** kommen aus dem Shopify- und Amazon-Kanal, gepflegte Daten fließen in Umsatz, Kanal-Aufschlüsselung und Profitabilität.
- **Werbekosten und Kampagnen** stammen aus Meta Ads, Google Ads, TikTok Ads und Amazon Ads (sobald verbunden) und speisen ROAS, Attribution und Creative-Analyse.
- **Fixkosten und Payment-Gebühren** aus dem Kosten-Bereich werden in der Gewinnrechnung der Übersicht sowie in Reports berücksichtigt.
- **Reports** lassen sich als CSV oder PDF exportieren und in Buchhaltung oder Board-Meetings weiterverwenden.
- **Rechnungen und Versand** (eigene Hubs) nutzen dieselben Bestell- und Produktdaten, tauchen aber dort in ihren eigenen Ansichten auf.

## Häufige Fragen

### Warum weichen die Zahlen von meinem Shopify-Backend ab?
Filapen zieht Umsatz brutto und rechnet MwSt sowie Retouren heraus, damit der Gewinn realistisch ist. Zudem werden Amazon-Bestellungen dazu addiert. Kleine Differenzen zu Shopify allein sind daher normal.

### Wie oft werden die Daten aktualisiert?
Bestellungen und Umsatz werden regelmäßig automatisch synchronisiert. Über *Integrationen* kannst du jederzeit einen manuellen Sync auslösen, wenn du nicht warten willst.

### Was bedeuten die Farben bei ROAS und Marge?
Grün heißt gut (ROAS ab 2,0x, Marge ab 25 Prozent), Gelb bedeutet knapp (ROAS 1,0 bis 2,0x, Marge 10 bis 25 Prozent), Rot ist Verlust oder Warnung. So siehst du auf einen Blick, wo du hinschauen musst.

### Warum sind Amazon-Werbekosten noch nicht in ROAS enthalten?
Amazon Ads benötigt einen separaten API-Zugang, der aktuell noch in Vorbereitung ist. Sobald verbunden, taucht der Wert automatisch in KPI-Karten, Kampagnenliste und Attribution auf.
`;
