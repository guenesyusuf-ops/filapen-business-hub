export const content = `# Home

## Was ist Home
Home ist deine Startseite nach dem Login. Sie fasst zusammen, was heute für dich wichtig ist: offene Aufgaben, Termine, Notizen, Genehmigungen und wer aus dem Team gerade online ist. Von hier springst du in einem Klick in die passende Detail-Ansicht.

## Was du hier siehst

- **Begrüßung oben:** Zeigt Wochentag, Datum und deinen Namen. Rein informativ.
- **Kennzahlen (drei Kacheln):** *Offene Aufgaben*, *Heute fällig*, *Heute erledigt*. Bezieht sich immer auf dich persönlich, nicht auf das ganze Team.
- **Warten auf Genehmigung:** Dokumente oder Inhalte, die auf deine Freigabe warten. Nur sichtbar, wenn du Genehmiger bist.
- **Urlaubs-Posteingang:** Offene Urlaubsanträge deiner Mitarbeiter. Nur für Owner und Admin.
- **Meine Aufgaben:** Deine nächsten offenen To-dos aus dem Work-Management. Überfällige sind rot markiert.
- **Kalender:** Monatsansicht mit deinen persönlichen Terminen und genehmigten Urlauben des Teams (farbig pro Person). Termine und Urlaube lassen sich direkt hier eintragen.
- **Notizen:** Kleine bunte Haftnotizen, die nur du siehst. Anpinnen für Wichtiges.
- **Posteingang:** Systemnachrichten und Shortcuts zu offenen Vorgängen.
- **Team:** Wer ist gerade online und wann war er zuletzt aktiv.
- **Rechner:** Kleines Werkzeug für Währungsumrechnung, Mehrwertsteuer und schnelles Kopfrechnen.

## Häufige Workflows

### Workflow 1: Tag starten
1. Öffne Home direkt nach dem Login.
2. Prüfe die drei Kennzahlen oben: Wie viele Aufgaben sind heute fällig?
3. Schau in *Meine Aufgaben*, ob etwas Überfälliges dabei ist.
4. Öffne den Kalender und wirf einen Blick auf den heutigen Tag.
5. Erledige zuerst rote (überfällige) und dann heute fällige Aufgaben.

### Workflow 2: Termin oder Urlaub eintragen
1. Klicke im Kalender-Widget auf den gewünschten Tag.
2. Für einen Termin: Button *Termin* oben rechts. Titel, Uhrzeit, Farbe und optional Erinnerung setzen, dann *Speichern*.
3. Für Urlaub: Button *Urlaub*. Zeitraum und Grund eintragen und absenden.
4. Der Antrag geht an Owner oder Admin. Sobald entschieden ist, siehst du oben rechts eine Benachrichtigung.

### Workflow 3: Notiz festhalten
1. Tippe deinen Text in das Feld *Neue Notiz*.
2. Wähle darunter eine Farbe.
3. Klick auf *Speichern*.
4. Fahre später mit der Maus über eine Notiz, um sie anzupinnen (bleibt oben) oder zu löschen. Zum Bearbeiten einfach auf den Text klicken.

### Workflow 4: Genehmigung erteilen (nur Owner/Admin)
1. Prüfe die Sektion *Warten auf Genehmigung* oder den *Urlaubs-Posteingang*.
2. Öffne den Eintrag, um Details zu sehen.
3. Bestätige oder lehne ab. Bei Ablehnung ist ein Grund Pflicht.
4. Der Antragsteller bekommt beim nächsten Home-Besuch ein Popup mit deiner Entscheidung.

## Verknüpfungen mit anderen Modulen
- **Meine Aufgaben** und die Aufgaben-Kennzahlen kommen aus dem *Work-Management*. Ein Klick auf eine Aufgabe öffnet das zugehörige Projekt.
- **Warten auf Genehmigung** verweist auf *Dokumente* und weitere Module mit Freigabe-Prozess.
- **Kalender** zeigt deine persönlichen Termine plus Urlaube aus dem *Urlaubs-Modul*.
- **Posteingang** bündelt Benachrichtigungen aus allen Modulen (Mentions, neue Zuweisungen usw.).
- **Team** zeigt Präsenzen aus dem *Nutzer-Management*.

## Häufige Fragen

### Warum sehe ich den Urlaubs-Posteingang oder die Genehmigungen nicht?
Diese Bereiche erscheinen nur für Rollen, die freigeben dürfen — also Owner und Admin. Als normaler Mitarbeiter siehst du stattdessen deine eigenen Anträge und Aufgaben.

### Sind meine Notizen für andere sichtbar?
Nein. Notizen und persönliche Termine sind privat und nur für dich sichtbar. Urlaube dagegen sind für das Team im Kalender sichtbar, sobald sie genehmigt sind.

### Warum ändert sich die Anzahl der offenen Aufgaben nicht sofort?
Die Zahlen aktualisieren sich automatisch beim Wechsel zurück auf Home. Auf dem Handy kannst du die Seite auch nach unten ziehen (*Pull-to-Refresh*), um alles neu zu laden.

### Kann ich einen Termin nachträglich ändern?
Titel und Zeit kannst du nicht direkt bearbeiten. Lösche den Eintrag über das X-Symbol beim Termin und lege ihn neu an. Urlaube werden über das Urlaubs-Modul verwaltet.`;
