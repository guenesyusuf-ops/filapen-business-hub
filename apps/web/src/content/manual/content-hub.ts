export const content = `# Content Hub

## Was ist der Content Hub
Der Content Hub ist deine zentrale Werkstatt für Werbetexte, Ad-Copy, Hooks, UGC-Skripte und Social-Captions. Statt Texte in einem Extra-Tool zu schreiben und dann rüberzukopieren, generierst du hier mit KI direkt anhand deiner Produkte, deiner Zielgruppe und deiner Marken-Tonalität. Alles Erzeugte landet in einer Bibliothek, die du filtern, bewerten und wiederverwenden kannst. Zusätzlich kannst du erfolgreiche Ads deiner Wettbewerber durchsuchen und als Vorlage speichern.

## Was du hier findest

- **Übersicht:** Startseite mit den vier wichtigsten Kennzahlen (Gesamt-Content, veröffentlicht, KI-generiert, Templates) plus Balken-Diagrammen nach Content-Typ und Status. Von hier springst du in einem Klick in die anderen Bereiche.
- **Library:** Alle deine erstellten und generierten Inhalte in Kartenform, filterbar nach Typ, Status, Plattform und Quelle. Im zweiten Tab durchsuchst du live die Meta Ad Library nach Konkurrenz-Ads mit echten Impressionen, Spend-Range und Zielgruppen-Daten.
- **Generieren:** Konfigurations-Formular auf der linken Seite (Produkt, Zielgruppe, Angle, Framework, Tonalität, Anforderungen an Headline/Primärtext/CTA), rechts die KI-generierten Varianten mit Sterne-Bewertung, Copy- und Save-Buttons.
- **Templates:** Wiederverwendbare Prompt-Vorlagen mit Platzhaltern wie {{product_name}} oder {{benefits}}. System-Templates von Filapen sind schon eingebaut, eigene legst du dazu an.
- **Brand Voice:** Deine Markenstimmen mit Tonalitäts-Reglern (Formalität, Humor, Energie, Wärme), Beispielsätzen und einer Blockliste für verbotene Wörter. Wird beim Generieren als Referenz mitgegeben.

## Häufige Workflows

### Workflow 1: Erste Marken-Stimme anlegen
1. Öffne *Brand Voice* und klicke oben rechts auf *Create Brand Voice*.
2. Gib einen Namen ein, beschreibe kurz die Persönlichkeit deiner Marke.
3. Ziehe die vier Regler auf die passenden Werte und trage 3–5 Beispielsätze ein, die typisch für dich klingen.
4. Ergänze verbotene Wörter, die die KI nie verwenden soll (z. B. „billig", „Klick hier").
5. Setze das Häkchen bei *Set as default* und speichere. Ab jetzt wird diese Voice standardmäßig beim Generieren vorgeschlagen.

### Workflow 2: Ad-Copy für ein Produkt generieren
1. Öffne *Generieren*. Wähle oben *Produkt aus System wählen* — Name, Beschreibung und Preis werden aus dem Finance Hub übernommen.
2. Ergänze Zielgruppe, Pain Points und Wunschzustand. Wähle Awareness-Level und Funnel-Stufe (TOFU/MOFU/BOFU).
3. Suche unter *Creative Direction* Framework (AIDA, PAS, BAB …), Emotion, CTA-Typ, Tonalität und deine Brand Voice aus.
4. Stelle unter *AI Requirements* ein, wie viele Headlines, Primärtexte, Linkbeschreibungen und CTAs du willst. Klick auf *Mit KI generieren*.
5. Bewerte die Varianten mit Sternen, kopiere die beste per Copy-Button oder speichere sie mit *Save* in der Library.

### Workflow 3: Konkurrenz-Ad als Template übernehmen
1. Öffne *Library* und wechsele auf den Tab *Wettbewerber Ads*.
2. Gib einen Markennamen ein, wähle das Land und klicke *Suchen*.
3. Sichte die Ergebnisse mit Live-Vorschau, Impressionen, Spend und Zielgruppen-Anteilen.
4. Klicke bei einem gelungenen Beispiel auf *Als Template speichern*. Der Ad-Text landet als Draft in deiner Library mit Tag „wettbewerber".
5. Öffne später *Generieren* und referenziere den Text im Feld *Top Competitor Ad Copy*, damit die KI in ähnlichem Stil, aber mit deinem Produkt schreibt.

## Verknüpfungen mit anderen Modulen
- **Finance Hub:** Der Produkt-Dropdown beim Generieren und beim Templates-Anlegen zieht Titel, Beschreibung und Preis direkt aus deinem Produkt-Katalog. Manuelles Abtippen entfällt.
- **Email Marketing:** Generierte Headlines und Primärtexte lassen sich per Copy in Betreffzeilen und Kampagnen-Texte übernehmen.
- **Work Management:** Content-Freigaben (Status *In Review* → *Approved*) tauchen im Home-Widget *Warten auf Genehmigung* auf, wenn du Genehmiger bist.
- **Meta Ad Library:** Externe Anbindung — du brauchst einen gültigen META_ACCESS_TOKEN in den System-Einstellungen, sonst zeigt der Ads-Tab einen Hinweis.

## Häufige Fragen

### Warum kommt bei der Ad-Library-Suche „nicht konfiguriert"?
Der Meta-API-Zugang fehlt. Ein Admin muss einmalig einen Access-Token als Umgebungsvariable hinterlegen, danach funktioniert die Suche für alle.

### Was ist der Unterschied zwischen Template und Brand Voice?
Ein Template legt die Struktur eines Textes fest (z. B. „Hook + drei Benefits + CTA"). Eine Brand Voice legt fest, *wie* der Text klingt (locker vs. formell, mit oder ohne Humor). Beides zusammen sorgt für konsistente, markentreue Inhalte.

### Werden meine generierten Texte automatisch veröffentlicht?
Nein. Alles landet zuerst als *Draft* in der Library. Du entscheidest selbst, was du kopierst, an anderer Stelle einsetzt oder auf *Approved* bzw. *Published* setzt.

### Kann ich die KI zwingen, Emojis zu verwenden — oder nicht?
Ja. In der Config beim Generieren gibt es einen Schalter *Emojis verwenden*. Zusätzlich kannst du in der Brand Voice unter *Banned Words* Emojis oder ganze Wörter blockieren, die nie auftauchen dürfen.`;
