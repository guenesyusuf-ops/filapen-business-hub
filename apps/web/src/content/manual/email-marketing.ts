export const content = `# Email Marketing

## Was ist das Email-Marketing-Modul

Dein eigenes Newsletter- und Automations-Tool direkt im Hub — die Alternative zu Klaviyo oder Mailchimp. Kontakte, Segmente, Kampagnen und Trigger-Flows an einem Ort, angebunden an deinen Shopify-Shop und über Resend versendet. Du zahlst nur den Resend-Preis und behältst deine Kundendaten im eigenen System.

Kontakte werden automatisch aus Shopify synchronisiert (Consent-Status, Bestellhistorie, Umsatz), ein Tracking-Snippet im Theme erfasst Produktaufrufe und Warenkorb-Adds, und du kannst daraus Zielgruppen bauen — von "letzte 30 Tage gekauft" bis "hat Warenkorb liegen gelassen".

## Was du hier findest

**Übersicht** — Dashboard mit den vier Kern-Kennzahlen (Kontakte, aktive Abonnenten, Kampagnen, Automations) plus Onboarding-Checkliste für den Erststart.

**Kontakte** — Alle Empfänger mit Consent-Status, Land, Bestellzahl und Gesamtumsatz. Filterbar nach Consent (angemeldet, doppelt bestätigt, abgemeldet). Kontakte werden nicht manuell gepflegt, sondern aus Shopify gezogen.

**Segmente** — Regel-basierte Zielgruppen wie "Umsatz > 200€ in 30 Tagen" oder "Warenkorb abgebrochen". Du baust sie im Segment-Builder aus Kriterien, kannst sie jederzeit neu berechnen und wiederverwenden.

**Kampagnen** — Einmalige Sends. Wähle Template, Segment und Consent-Modus, plane den Versand oder schick ihn direkt raus. Nach dem Versand siehst du Öffnungs- und Klickrate direkt in der Liste.

**Automations (Flows)** — Trigger-basierte Serien wie Welcome-Flow bei neuem Kunden, Abandoned-Cart-Reminder oder Post-Purchase-Follow-up. Es gibt Schnellstart-Vorlagen zum Ein-Klick-Installieren, du kannst sie aktivieren, pausieren, archivieren.

**Templates** — Wiederverwendbare Email-Designs aus Blöcken (Überschrift, Text, Bild, Button, Produkt). Variablen wie {{first_name}} werden beim Versand ersetzt. Templates können dupliziert und in Kampagnen wie Flows verwendet werden.

**Analytics** — Aggregierte Performance über alle Kampagnen: Öffnungs- und Klickraten, pro Kampagne und Flow. Revenue-Attribution (welche Bestellung kam aus welcher Email) kommt in einer späteren Ausbaustufe.

**Einstellungen** — Absender-Identität, Sending-Domain (mail.filapen.de), Consent-Regeln, Frequency-Cap (max. Emails pro Kontakt pro Tag), Tracking-Snippet für dein Shopify-Theme, Unsubscribe-Footer.

## Häufige Workflows

**Erste Kampagne verschicken**
1. Unter "Templates" ein Design anlegen oder duplizieren — Betreff, Blöcke, ggf. {{first_name}} nutzen
2. Unter "Segmente" eine Zielgruppe bauen (z.B. "aktive Käufer letzte 90 Tage") und einmal berechnen lassen
3. In "Kampagnen" auf "Neue Kampagne", Name, Template und Segment wählen
4. Consent-Modus entscheiden — für Newsletter reicht "Nur Angemeldete", bei sensiblen Aktionen "Nur Doppel-Opt-In"
5. Sende-Datum leer lassen für Sofortversand oder Zeitpunkt planen, dann anlegen und in der Detailansicht abschicken

**Segment mit Regeln bauen**
1. In "Segmente" auf "Neues Segment", Name und optionale Beschreibung setzen
2. Regeln stapeln — z.B. Consent = angemeldet, Umsatz > 100€, letzte Bestellung < 30 Tage
3. Speichern — das Segment berechnet sich einmal und zeigt die Mitgliederzahl
4. Bei Bedarf über das Refresh-Icon neu berechnen lassen, sobald sich Kontakte geändert haben
5. Segment danach in Kampagnen oder als Filter in Flows verwenden

**Automation-Flow anlegen**
1. In "Automations" einen der Schnellstart-Flows installieren (Welcome, Abandoned Cart, Post-Purchase)
2. Der Flow landet als Entwurf in der Liste — Namen, Emails und Wartezeiten nach Bedarf anpassen
3. Aktivieren über das Play-Icon — ab dann wandern passende Kontakte automatisch in den Flow
4. In "Analytics" oder direkt in der Flow-Liste sehen, wie viele Kontakte enrolled und completed sind
5. Bei Änderungen erst pausieren, dann bearbeiten, danach wieder aktivieren

## Verknüpfungen mit anderen Modulen

Kontakte und Bestellungen kommen aus deinem Shopify-Shop — der wird in den globalen Einstellungen verbunden. Das Tracking-Snippet läuft im Focal-Theme und speist Produktaufrufe zurück in den Hub. Segmente können sich auf Shopify-Bestelldaten stützen (Umsatz, Bestellzahl, Land). Die Sending-Domain sitzt bei United Domains, die Zustellung übernimmt Resend Pro. Templates und Flows haben aktuell keine Verbindung zum NFC- oder Doc-Share-Modul.

## Häufige Fragen

**Warum sehe ich keine Kontakte, obwohl Shopify verbunden ist?**
Die Sync läuft bei der Verbindung einmal komplett durch. Wenn du sie nach dem Modul-Deploy angelegt hast, verbindest du den Shop in den Einstellungen noch einmal neu — dann wird die Kundenhistorie mitgezogen.

**Was heißt "Consent-Modus" in einer Kampagne?**
Bestimmt, wer eingeschlossen wird. "Nur Angemeldete" reicht rechtlich für die meisten Newsletter, "Nur Doppel-Opt-In" ist die sichere Variante bei Werbeaktionen und "Alle nicht-abgemeldeten" schließt auch Kunden ein, die nie aktiv zugestimmt haben — dann brauchst du eine belastbare rechtliche Grundlage (z.B. Bestandskunden nach §7 UWG).

**Warum steht "Domain noch nicht verifiziert"?**
Solange DKIM, SPF und DMARC nicht bei United Domains gesetzt sind, sind deine Emails eher im Spam-Ordner. Sobald Resend Pro aktiv ist, bekommst du die Record-Werte im Resend-Dashboard und trägst sie bei United Domains ein — dann verschwindet der Hinweis.

**Wann kommt Revenue-Attribution?**
Steht auf der Roadmap. Braucht UTM-Parameter in allen Kampagnen-Links plus Bestell-Rückverfolgung im Shop. Bis dahin siehst du Öffnungs- und Klickrate, aber nicht direkt den Umsatz je Email.`;
