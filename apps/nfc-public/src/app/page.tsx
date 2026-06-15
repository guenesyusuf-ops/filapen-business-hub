import { Radio, Shield, Phone, ScanLine } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md text-center space-y-6">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 items-center justify-center shadow-xl mx-auto">
          <Radio className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            NFC4you
          </h1>
          <p className="text-base text-slate-600 mt-2">
            Sicherheitsbänder für Kinder mit NFC-Technologie
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 text-left space-y-4">
          <div className="flex items-start gap-3">
            <ScanLine className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Einfach scannen</div>
              <div className="text-sm text-slate-600 mt-0.5">Wer ein NFC-Band findet, hält das Handy daran und sieht die Notfall-Daten.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Sofort anrufen</div>
              <div className="text-sm text-slate-600 mt-0.5">Ein Klick und die hinterlegte Telefonnummer wird gewählt.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">DSGVO-konform</div>
              <div className="text-sm text-slate-600 mt-0.5">Daten werden verschlüsselt gespeichert. Eltern können jederzeit löschen.</div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Diese Seite ist Teil des NFC4you-Systems. Hast du ein Band? Halte dein Handy daran — du wirst automatisch weitergeleitet.
        </p>
      </div>
    </div>
  );
}
