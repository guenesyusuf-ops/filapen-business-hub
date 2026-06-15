export default function AgbPage() {
  return (
    <div className="min-h-[100dvh] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Allgemeine Geschäftsbedingungen</h1>
        <div className="prose prose-sm prose-slate max-w-none space-y-4 text-slate-700">
          {/* TODO: Anwalt-Text einsetzen */}
          <p className="text-xs text-slate-500 italic">
            Platzhalter — finale AGB durch Anwalt erstellen.
          </p>
          <h2 className="text-lg font-semibold">§1 Geltungsbereich</h2>
          <p>...</p>
          <h2 className="text-lg font-semibold">§2 Vertragsschluss</h2>
          <p>...</p>
          <h2 className="text-lg font-semibold">§3 Haftungsbeschränkung</h2>
          <p>Die im NFC-System hinterlegten Daten dienen ausschließlich als Hilfe zur Notfallkontakt-Aufnahme. Es wird keine Haftung übernommen für ...</p>
        </div>
      </div>
    </div>
  );
}
