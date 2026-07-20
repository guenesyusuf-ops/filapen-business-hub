export const content = `# Einstellungen

## Was ist das Einstellungen-Modul
Die Einstellungen sind die zentrale Schaltstelle für alles, was dich und dein Team betrifft: dein persönliches Profil, dein Farbschema, deine Kollegen, deren Zugriffsrechte und die Freigabe neuer Registrierungen. Wer im Hub arbeitet, was er sieht und wie es aussieht — hier wird es festgelegt.

## Was du hier findest

**Allgemein**
Grundeinstellungen für deine Organisation: Name, Zeitzone, Währung, Geschäftsjahres-Start und Sprache. Einmal setzen, gilt für alle Zahlen und Datumsangaben im Hub.

**Persönliches Profil**
Dein Name, Telefonnummer, Profilbild und deine Rolle. Zusätzlich wählst du hier dein persönliches Farbschema — greift sofort in der ganzen App, aber nur bei dir.

**Team**
Alle Mitglieder deiner Organisation auf einen Blick. Du siehst Rolle, Zugriffsrechte auf Menüs und wann jemand zuletzt aktiv war. Von hier aus lädst du neue Kollegen ein, änderst Rollen oder entfernst Mitglieder.

**Genehmigungen**
Warteschlange für Neuregistrierungen. Wer sich selbst registriert, landet hier zur Freigabe — du erteilst Rolle und schaltest frei oder lehnst ab.

**Integrationen**
Zu finden unter Finance → Integrationen: Kommandozentrale für Shopify, Meta Ads, Google Ads, Amazon, Versand-Carrier (DHL, UPS, DPD, Hermes, GLS) und Email-Provider Resend. Verbindungen einrichten, synchronisieren und trennen.

**Anleitungen**
Alle Modul-Handbücher des Hubs, direkt lesbar ohne die App zu verlassen.

## Häufige Workflows

**Team-Mitglied einladen**
1. Team öffnen und auf \`Mitglied einladen\` klicken.
2. E-Mail-Adresse eintragen.
3. Rolle wählen: Admin (voller Zugriff) oder Mitarbeiter (nur ausgewählte Menüs).
4. Bei Mitarbeiter die Menüs abhaken, die freigeschaltet werden sollen.
5. Senden — der Kollege bekommt eine Einladung per Mail; alternativ kopierst du bei \`Offene Einladungen\` den Link und schickst ihn selbst.

**Neuregistrierung freigeben**
1. Genehmigungen öffnen — offene Anträge stehen oben mit rotem Zähler.
2. Beim Antragsteller die Rolle festlegen (Admin, Analyst oder Viewer).
3. Auf \`Approve\` klicken und bestätigen — der User bekommt sofort Zugriff.
4. Bei Verdacht auf Spam oder Fehler stattdessen \`Reject\` — der User bleibt ausgesperrt.

**Shopify verbinden**
1. Zu Finance → Integrationen wechseln.
2. Bei Shopify auf \`Verbinden\` klicken.
3. Deine Shop-Domain eintragen (z.B. \`meinshop.myshopify.com\`) und bestätigen.
4. In Shopify durch den Autorisierungs-Flow gehen — du landest wieder im Hub mit grüner Bestätigung.
5. Erster Sync läuft automatisch; danach jederzeit über \`Sync\` manuell anstoßen.

## Verknüpfungen mit anderen Modulen
Rollen und Menü-Berechtigungen aus dem Team-Bereich steuern, was jedes Mitglied im gesamten Hub sieht — vom Home-Dashboard bis zu Finance, Sales, NFC, Versand und allen anderen Modulen. Wer keine Berechtigung für ein Menü hat, sieht es im Sidebar gar nicht erst. Owner und Admins haben immer Vollzugriff, Mitarbeiter nur auf das, was explizit freigeschaltet ist. Integrationen (Shopify, Versand-Carrier, Email) sind die Datenquellen für Finance-Hub, Versand-Modul und Email-Marketing — ohne Verbindung kein Datenfluss.

## Häufige Fragen

**Kann ich meine E-Mail-Adresse ändern?**
Nein, nicht selbst. Ein Admin muss das für dich in der Datenbank machen. Name, Telefon und Bild kannst du im Profil jederzeit anpassen.

**Warum sieht ein Kollege ein Menü nicht?**
Meist fehlt die Berechtigung. Im Team-Bereich beim Mitglied auf das Drei-Punkte-Menü klicken, \`Berechtigungen bearbeiten\` wählen und den entsprechenden Menüpunkt anhaken.

**Was passiert bei \`Zu Admin befördern\`?**
Der Mitarbeiter bekommt sofort Vollzugriff auf alle Menüs und darf selbst Team-Mitglieder einladen, Rollen ändern und entfernen. Vergib das nur an Vertrauenspersonen.

**Wieso ist mein Farbschema anders als das der Kollegen?**
Das Farbschema ist eine persönliche Präferenz — jeder wählt sein eigenes im Profil. Die Organisation-Einstellungen (Währung, Zeitzone) gelten dagegen für alle.
`;
