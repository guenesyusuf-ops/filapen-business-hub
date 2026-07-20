export const content = `# Versand

## Was ist das Versand-Modul
Hier laufen alle Bestellungen ein, die verschickt werden müssen. Du druckst DHL-Labels (einzeln oder für 200 Bestellungen auf einmal), verfolgst welche Pakete unterwegs sind, korrigierst kaputte Kundenadressen und lässt automatische Status-Emails an Kunden rausgehen. Bestellungen kommen automatisch aus Shopify rein — versandte, stornierte und rückerstattete werden bei jedem Sync aus der Liste entfernt, damit du nur siehst, was wirklich noch offen ist.

## Was du hier findest

**Übersicht.** Startseite mit KPIs (offene Bestellungen, aktive Sendungen, Labels heute, zugestellt im Monat) und einer Go-Live-Checkliste für den erstmaligen Setup.

**Bestellungen.** Das Herzstück — alle offenen Shopify-Bestellungen, filterbar nach Produkten, Versand-Status und Adressfehlern. Hier wählst du Bestellungen aus und erstellst per Klick DHL-Labels.

**Labels.** Archiv aller erstellten Versand-Labels mit Tabs für "Erstellt" (noch nicht gedruckt), "Gedruckt" und "Alle". Bulk-Druck, Bulk-Download, optional inklusive Lieferscheinen.

**Sendungen.** Alle Sendungen mit Tracking-Nummer, Status, Carrier und Gewicht. Suche nach Tracking-Nr, Empfänger oder Bestellnummer.

**Regeln.** Automatische Auswahl von Carrier oder Versand-Methode nach Bedingungen (z.B. "Gewicht über 5 kg → DHL Paket" oder "Land = CH → Versand blockieren"). Regeln werden in Prioritäts-Reihenfolge ausgewertet.

**Produkte & Versanddaten.** Pro Produktvariante Gewicht, Maße, HS-Code, Herkunftsland und EAN pflegen — nötig fürs Auto-Berechnen der Versandkosten und für Auslandssendungen mit Zoll.

**Integrationen.** Carrier-Konten (DHL, UPS, DPD, Hermes, GLS) mit Credentials + Absender-Adresse verwalten. DHL läuft im Sandbox- oder Produktions-Modus. Marktplatz-Übersicht (Shopify aktiv, Amazon read-only, Kaufland/TikTok in Vorbereitung).

**Automatische Emails.** Pro Sendungsstatus (Label erstellt, unterwegs, zugestellt, Zustellung fehlgeschlagen …) eine Email an den Kunden triggern. Templates kommen aus dem Email-Marketing-Modul.

## Häufige Workflows

**DHL-Labels für mehrere Bestellungen drucken.**
1. Öffne "Bestellungen" — die Liste synchronisiert beim Öffnen automatisch mit Shopify.
2. Setze Filter je nach Tagesplan (z.B. "Ohne Label/Sendung" + "Nur offen").
3. Häkchen bei den gewünschten Bestellungen setzen (oder oben "Alle").
4. Klick auf "N × DHL Label erstellen" — Bestätigen — das System sendet an DHL und zeigt Erfolge/Fehler pro Bestellung.
5. Wechsel zu "Labels", tab "Erstellt", alle markieren, "Drucken" — optional Häkchen bei "Lieferscheine zusätzlich als separate PDF".

**Bestellungen ohne bestimmtes Produkt anzeigen.**
1. In "Bestellungen" auf "Produkt-Filter" klicken.
2. Umschalten von "MIT ausgewählten Produkten" auf "OHNE ausgewählte Produkte".
3. Produkt(e) suchen und anhaken — die Liste filtert sofort.
4. Für exaktere Regeln (z.B. "genau 2× dieses Produkt, sonst nichts") den zweiten Filter "SKU = Menge" nutzen: Produkt(e) wählen, Operator (=, ≥, ≤, enthält …) und Summen-Menge festlegen.

**Adressfehler beheben.**
1. In "Bestellungen" den roten Tab "Adressfehler" öffnen — die Badge-Zahl zeigt, wie viele Bestellungen betroffen sind.
2. Bei einer Bestellung "Korrigieren" klicken — die kaputte Original-Adresse steht oben, editierbare Felder unten.
3. Straße, Hausnummer, PLZ, Stadt und Land ausfüllen (Pflichtfelder mit Stern).
4. Speichern — die Bestellung wandert automatisch zurück in den Haupt-Tab und ist versandfertig.

**Manuell mit Shopify abgleichen (Reconcile).**
1. Wenn du glaubst die Liste ist veraltet: Button "Aus Shopify nachladen" oben rechts.
2. Der Sync holt alle offenen Bestellungen frisch und entfernt versandte/stornierte/rückerstattete — läuft ein paar Sekunden mit sichtbarer Progress-Bar.
3. Danach zeigt die Statusleiste an, wie viele Bestellungen geprüft und aktualisiert wurden.

## Verknüpfungen mit anderen Modulen

**Verkauf.** Bestellungen fließen direkt aus Shopify (und später Amazon, Kaufland, TikTok) rein — der Sync ist derselbe, den auch das Verkaufsmodul nutzt. Umsatz-Zahlen und Versand-Zahlen ziehen aus derselben Quelle.

**Retouren.** Sobald DHL eine Rücksendung erkennt, taucht die Sendung mit Status "returned" in "Sendungen" auf — das Retouren-Modul greift auf dieselbe Sendungs-Tabelle zu und erstellt daraus einen Retouren-Vorgang.

**Email-Marketing.** Die Templates für automatische Versand-Emails werden dort erstellt und im Versand-Modul pro Sendungsstatus zugeordnet. Änderungen am Template wirken sich sofort auf zukünftige Versand-Mails aus.

**Produkte.** Gewicht, Maße und HS-Codes pflegst du in "Versand → Produkte & Versanddaten". EAN-Änderungen dort landen direkt auf der Shopify-Variante und werden vom Sales-Modul als Match-Quelle für Wareneinsatz-Zuordnung genutzt.

## Häufige Fragen

**Warum verschwinden Bestellungen aus der Liste?**
Der automatische Sync entfernt versandte, stornierte und rückerstattete Bestellungen — nur wirklich offene bleiben. Wenn du eine Bestellung vermisst: prüfe in Shopify den Status, dann "Aus Shopify nachladen" drücken.

**Sandbox vs. Produktion bei DHL — was heißt das?**
Sandbox = Test-Modus mit DHL-Test-EKPs (z.B. 33333333330101). Die Labels sind nicht versandfähig, aber du kannst den Prozess durchspielen. Produktion = echte Labels mit echten Kosten. Umschalten geht in "Integrationen" beim jeweiligen DHL-Konto.

**Was passiert, wenn ein Label-Druck fehlschlägt?**
Bei Bulk-Aktionen zeigt das Alert die DHL-Fehlermeldungen an (z.B. "PLZ ungültig", "EKP-Nr fehlt"). Erfolgreiche Labels wurden erstellt — die fehlgeschlagenen bleiben in der Bestellungs-Liste und du kannst nach der Korrektur nochmal probieren.

**Wie funktionieren die Versandregeln?**
Regeln werden in Prioritäts-Reihenfolge geprüft. Sobald eine passt, greift sie und die weiteren werden übersprungen. Aktionen: Carrier wählen, Methode wählen oder Sendung blockieren. Gut für Länder-spezifische Regeln oder Gewichts-Schwellen.`;
