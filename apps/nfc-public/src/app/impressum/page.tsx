export default function ImpressumPage() {
  return (
    <div className="min-h-[100dvh] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Impressum</h1>
        <div className="prose prose-sm prose-slate max-w-none space-y-4 text-slate-700">
          {/* TODO: Anwalt-Text einsetzen */}
          <p><strong>Angaben gemäß § 5 TMG</strong></p>
          <p>
            [Vollständiger Firmenname]<br />
            [Straße + Nummer]<br />
            [PLZ + Ort]<br />
            Deutschland
          </p>
          <p><strong>Vertreten durch:</strong> [Name Geschäftsführer]</p>
          <p>
            <strong>Kontakt:</strong><br />
            Telefon: [Nummer]<br />
            E-Mail: [E-Mail]
          </p>
          <p>
            <strong>Registereintrag:</strong><br />
            Eintragung im Handelsregister<br />
            Registergericht: [Gericht]<br />
            Registernummer: [HRB-Nummer]
          </p>
          <p>
            <strong>Umsatzsteuer-ID:</strong> [USt-IdNr]
          </p>
          <hr />
          <p className="text-xs text-slate-500 italic">
            Dieser Inhalt ist ein Platzhalter und muss vor dem Live-Gang durch deinen Anwalt finalisiert werden.
          </p>
        </div>
      </div>
    </div>
  );
}
