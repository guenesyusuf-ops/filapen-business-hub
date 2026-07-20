export const content = `# NFC4you

## Was ist das NFC-Modul
NFC4you ist dein Backend für die physischen NFC-Bänder, die du an Eltern verkaufst. Jedes Band trägt einen 6-stelligen Code und eine fest aufgedruckte URL. Wird das Band gescannt, öffnet sich eine Notfall-Seite mit den hinterlegten Kontaktdaten — für Kinder gedacht, die verloren gegangen sind oder Hilfe brauchen. Im Hub verwaltest du die komplette Kette: Codes generieren, Bänder produzieren, an Käufer versenden, Aktivierung durch den Kunden nachvollziehen und im Ernstfall auf hinterlegte Kontaktdaten zugreifen.

## Was du hier findest

- **Übersicht:** Startseite mit KPIs zu Gesamtbändern, aktivierten und nicht aktivierten Codes, heutigen Aktivierungen, Zahlen der letzten sieben Tage und Scans der letzten 30 Tage. Von hier springst du direkt zu den wichtigsten Bereichen.
- **Codes generieren:** Erstellt in einem Rutsch bis zu 10.000 neue Codes als Batch. Die Codes sind zufällig, global eindeutig und werden mit Namen und Notiz versehen (z.B. "Charge März 2026"). Der Batch lässt sich als CSV exportieren und geht direkt an die Bänder-Produktion.
- **Alle Bänder:** Vollständige Liste aller je generierten Bänder mit Suche, Status-Filter (alle, nicht aktiviert, aktiviert, gelöscht) und Paginierung. Zeigt Scan-Zähler, letzter Scan, Batch-Zugehörigkeit und die öffentliche URL zum Kopieren oder Öffnen.
- **An Käufer senden:** Weist einem Kunden per E-Mail eine bestimmte Anzahl Codes zu — inklusive individuellem Aktivierungs-Link pro Code. Wählbar aus einem konkreten Batch oder aus dem freien Pool. Zeigt live, wie viele Codes verfügbar bzw. bereits zugewiesen sind.
- **Kundendaten:** DSGVO-geschützte Ansicht aller aktivierten Bänder mit Namen, Telefon, Adresse, Notiz, Consent-Version und Audit-Angaben. Jeder Zugriff wird protokolliert, Löschungen sind endgültig.

## Häufige Workflows

### Workflow 1: Neuen Bänder-Batch generieren und drucken lassen
1. Öffne *Codes generieren* und klicke auf *Neuer Batch*.
2. Trage die Anzahl (1 bis 10.000), einen sprechenden Namen (z.B. "Charge 2026-07 Lieferant X") und optional eine Notiz ein.
3. Klick auf *Codes erstellen* — die Codes werden sofort erzeugt.
4. In der Batch-Liste auf *CSV* klicken. Die Datei enthält alle Codes plus die zugehörigen URLs zum direkten Aufdruck aufs Band.
5. CSV an den Produzenten schicken. Sobald die Bänder physisch da sind, kannst du sie versandbereit machen.

### Workflow 2: Codes einem Käufer per Mail zuweisen
1. Öffne *An Käufer senden* und trage die E-Mail-Adresse des Kunden ein, optional den Namen für die Anrede.
2. Wähle die Anzahl Bänder (1 bis 1.000) und optional einen konkreten Batch — sonst werden beliebige freie Codes gezogen.
3. Ergänze eine interne Notiz (z.B. "Bestellung #4711").
4. Klick auf *Codes zuweisen + Mail senden*. Der Kunde bekommt sofort eine Mail mit einem Aktivierungs-Link pro Code.
5. Rechts in *Letzte Versände* siehst du die Bestätigung. Die zugewiesenen Codes gelten nun als "offen" bis der Kunde sie auf nfc4you.de aktiviert.

### Workflow 3: Kundendaten im Notfall einsehen
1. Öffne *Kundendaten*. Der DSGVO-Hinweis oben erinnert dich daran, dass jeder Zugriff protokolliert wird.
2. Nutze die Suche für Name, Telefon, E-Mail, Code oder Stadt.
3. Klick auf eine Zeile, um alle Kontaktdaten, Adresse, Notiz und Audit-Log (Consent, IP, Aktivierungszeitpunkt, Scans) im Detail zu sehen.
4. Telefon- und Mail-Links funktionieren direkt aus dem Detail heraus.
5. Nur wenn zwingend nötig: über *Endgültig löschen* alle Daten zu diesem Band entfernen. Das Band selbst bleibt physisch nutzbar und kann neu aktiviert werden.

## Verknüpfungen mit anderen Modulen
- **Verkauf und Bestellungen:** Verkaufte NFC-Bänder tauchen als Positionen in Shopify- oder Amazon-Bestellungen auf. Der Käufer bekommt die Codes über *An Käufer senden* per Mail zugewiesen — die Bestellnummer landet als interne Notiz beim Versand.
- **Versand und Fulfillment:** Die physischen Bänder werden über den Versand-Hub verpackt und verschickt. Die Codes selbst laufen digital, unabhängig vom Paket.
- **Rechnungen und Finance:** Umsatz aus NFC-Verkäufen fließt automatisch in den Finance Hub, weil die Bestellungen aus Shopify bzw. Amazon kommen. Kosten für Bänder-Produktion trägst du im Kosten-Bereich als Fixkosten oder Wareneinsatz ein.
- **Kundendaten:** Die im Hub sichtbaren Kontaktdaten stammen ausschließlich aus der Aktivierung durch den Endkunden auf nfc4you.de — sie fließen nicht ins CRM oder in E-Mail-Marketing.

## Häufige Fragen

### Was passiert, wenn ein Band verloren geht?
Wenn der Endkunde das verlorene Band findet und scannt, sieht er die Notfall-Seite mit deinen hinterlegten Kontaktdaten — genau dafür sind die Bänder gedacht. Sollte der Kunde das Band als endgültig verloren melden, kannst du in *Alle Bänder* den Status auf *Gelöscht* setzen. Der Code wird damit deaktiviert, die öffentliche Seite zeigt keine Daten mehr an. Der Kunde bekommt dann ein neues Band mit neuem Code.

### Kann ich einen Code nachträglich ändern?
Nein — auf keinen Fall. Der Code ist Hardware: Er ist physisch auf dem Band aufgedruckt und die URL zeigt fix auf genau diese Zeichenkombination. Änderst du den Code im System, wird das physische Band im gleichen Moment unbrauchbar, weil die URL ins Leere zeigt. Wenn ein Kunde ein neues Band braucht, weist du ihm einen komplett neuen Code zu.

### Wann gilt ein Band als "aktiviert"?
Erst wenn der Endkunde nach dem Kauf über den Link in seiner Mail auf nfc4you.de geht und dort seine Notfall-Kontaktdaten hinterlegt sowie den DSGVO-Consent bestätigt. Vorher ist der Code zwar dem Käufer zugewiesen (Status "offen"), enthält aber noch keine personenbezogenen Daten. Erst nach Aktivierung erscheint das Band unter *Kundendaten*.

### Kann der Kunde seine Daten selbst ändern?
Ja, wenn er bei der Aktivierung eine PIN vergeben hat. In *Kundendaten* siehst du in der Spalte *PIN*, ob eine PIN gesetzt ist. Ohne PIN kann nur der Hub-Admin die Daten ändern oder löschen — jeweils mit Audit-Log-Eintrag.
`;
