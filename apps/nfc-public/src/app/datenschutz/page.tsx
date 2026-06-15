export default function DatenschutzPage() {
  return (
    <div className="min-h-[100dvh] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Datenschutzerklärung</h1>
        <div className="prose prose-sm prose-slate max-w-none space-y-4 text-slate-700">
          {/* TODO: Anwalt-Text einsetzen */}
          <p><strong>Version:</strong> 2026-06-15-v1</p>

          <h2 className="text-lg font-semibold mt-6">1. Verantwortliche Stelle</h2>
          <p>[Firmenname], [Adresse], [E-Mail]</p>

          <h2 className="text-lg font-semibold mt-6">2. Welche Daten werden gespeichert?</h2>
          <p>Bei der Aktivierung eines NFC-Bandes können folgende Daten gespeichert werden:</p>
          <ul className="list-disc pl-5">
            <li>Vor- und Nachname (optional)</li>
            <li>Telefonnummer(n) (optional)</li>
            <li>E-Mail-Adresse (optional)</li>
            <li>Adresse: Straße, PLZ, Ort (optional)</li>
            <li>Freitext-Notiz (optional)</li>
            <li>Eine PIN als Hash (optional, für späteres Bearbeiten)</li>
            <li>IP-Adresse und User-Agent zum Zeitpunkt der Aktivierung (technische Pflicht)</li>
          </ul>
          <p>Alle Felder bis auf die Einwilligung sind <strong>freiwillig</strong>.</p>

          <h2 className="text-lg font-semibold mt-6">3. Zweck der Verarbeitung</h2>
          <p>
            Die Daten werden ausschließlich gespeichert, um eine Notfall-Kontaktaufnahme zu ermöglichen.
            Sie werden nur Personen angezeigt, die das physische NFC-Band scannen.
          </p>

          <h2 className="text-lg font-semibold mt-6">4. Rechtsgrundlage</h2>
          <p>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung der betroffenen Person bzw. ihrer Eltern).</p>

          <h2 className="text-lg font-semibold mt-6">5. Speicherdauer</h2>
          <p>
            Aktive Bänder: solange das Band aktiv ist. Bei 24 Monaten ohne Änderung erhalten Sie eine
            Erinnerung, danach werden Daten 30 Tage später automatisch gelöscht.
            Auf Wunsch löschen wir sofort.
          </p>

          <h2 className="text-lg font-semibold mt-6">6. Ihre Rechte</h2>
          <ul className="list-disc pl-5">
            <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO) — direkt im Edit-Bereich nutzbar</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Beschwerderecht bei der Aufsichtsbehörde</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">7. Datenverarbeiter</h2>
          <p>
            Hosting: [Anbieter Name]. Datenbank: Supabase (Frankfurt, DE). Es findet keine
            Datenübermittlung in Drittländer statt.
          </p>

          <h2 className="text-lg font-semibold mt-6">8. Kontakt für Datenschutz-Anfragen</h2>
          <p>[E-Mail-Adresse Datenschutz]</p>

          <hr />
          <p className="text-xs text-slate-500 italic">
            Dieser Inhalt ist ein Platzhalter und muss vor dem Live-Gang durch deinen Anwalt finalisiert werden.
          </p>
        </div>
      </div>
    </div>
  );
}
