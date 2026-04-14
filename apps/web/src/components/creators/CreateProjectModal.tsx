'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2, Calendar, FileText, Upload, Trash2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import {
  useCreateProject,
  useProductCatalog,
  CAMPAIGN_TYPE_LABELS,
  type ProjectCampaignType,
  type CreatorProject,
} from '@/hooks/creators/useProjects';

// ---------------------------------------------------------------------------
// Shared Tailwind classes (konsistent mit CreatorFormModal)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator placeholder:text-gray-400 dark:placeholder:text-gray-500';
const labelCls =
  'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (project: CreatorProject) => void;
}

const CAMPAIGN_TYPE_OPTIONS: { value: ProjectCampaignType; label: string }[] = [
  { value: 'discount', label: CAMPAIGN_TYPE_LABELS.discount },
  { value: 'launch', label: CAMPAIGN_TYPE_LABELS.launch },
  { value: 'push', label: CAMPAIGN_TYPE_LABELS.push },
  { value: 'other', label: CAMPAIGN_TYPE_LABELS.other },
];

export function CreateProjectModal({
  open,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const createProject = useCreateProject();
  const { data: products, isLoading: productsLoading } = useProductCatalog();

  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState<ProjectCampaignType>('discount');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [productId, setProductId] = useState('');
  const [neededCreators, setNeededCreators] = useState('5');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // PDF files per type
  const [briefingFiles, setBriefingFiles] = useState<File[]>([]);
  const [skriptFiles, setSkriptFiles] = useState<File[]>([]);
  const [sonstigeFiles, setSonstigeFiles] = useState<File[]>([]);
  const briefingRef = useRef<HTMLInputElement>(null);
  const skriptRef = useRef<HTMLInputElement>(null);
  const sonstigeRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setName('');
      setCampaignType('discount');
      setAction('');
      setStartDate('');
      setProductId('');
      setNeededCreators('5');
      setDescription('');
      setBriefingFiles([]);
      setSkriptFiles([]);
      setSonstigeFiles([]);
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Projektname ist erforderlich');
        return;
      }

      const count = parseInt(neededCreators, 10);
      if (!Number.isFinite(count) || count < 1) {
        setError('Bitte gib eine gültige Anzahl Creator an (min. 1)');
        return;
      }

      try {
        setUploadStatus('Projekt wird erstellt...');
        const created = await createProject.mutateAsync({
          name: name.trim(),
          campaignType,
          action: action.trim() || undefined,
          startDate: startDate || undefined,
          productId: productId || undefined,
          neededCreators: count,
          description: description.trim() || undefined,
        });

        const projectId = created?.id;
        const allFiles: { file: File; type: string }[] = [
          ...briefingFiles.map((f) => ({ file: f, type: 'briefing' })),
          ...skriptFiles.map((f) => ({ file: f, type: 'skript' })),
          ...sonstigeFiles.map((f) => ({ file: f, type: 'sonstige' })),
        ];

        if (projectId && allFiles.length > 0) {
          let uploaded = 0;
          for (const { file, type } of allFiles) {
            setUploadStatus(`Dokument ${uploaded + 1}/${allFiles.length} wird hochgeladen...`);
            try {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch(`${API_URL}/api/creator-projects/${projectId}/documents?type=${type}`, {
                method: 'POST',
                body: fd,
              });
              if (!res.ok) {
                const body = await res.text().catch(() => '');
                setError(`PDF "${file.name}" fehlgeschlagen: ${res.status} ${body.slice(0, 100)}`);
                setUploadStatus('');
                return; // Stop — don't close modal so user sees error
              }
              uploaded++;
            } catch (uploadErr) {
              setError(`PDF "${file.name}" Upload-Fehler: ${uploadErr instanceof Error ? uploadErr.message : 'Unbekannt'}`);
              setUploadStatus('');
              return;
            }
          }
        }

        setUploadStatus('');
        onSuccess?.(created);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Projekt konnte nicht angelegt werden',
        );
      }
    },
    [
      name,
      campaignType,
      action,
      startDate,
      productId,
      neededCreators,
      description,
      briefingFiles,
      skriptFiles,
      sonstigeFiles,
      createProject,
      onClose,
      onSuccess,
    ],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Projekt anlegen
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Projektname */}
          <div>
            <label className={labelCls}>Projektname *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Sommerkampagne 2026"
              required
              autoFocus
              className={inputCls}
            />
          </div>

          {/* Kampagnen-Art */}
          <div>
            <label className={labelCls}>Art der Kampagne *</label>
            <select
              value={campaignType}
              onChange={(e) =>
                setCampaignType(e.target.value as ProjectCampaignType)
              }
              className={inputCls}
            >
              {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Aktion */}
          <div>
            <label className={labelCls}>Aktion / Rabatt-Code</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="z.B. SUMMER20"
              className={inputCls}
            />
          </div>

          {/* Startdatum + Creator count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Startdatum</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
                <Calendar className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Benötigte Creator *</label>
              <input
                type="number"
                min="1"
                value={neededCreators}
                onChange={(e) => setNeededCreators(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Produkt */}
          <div>
            <label className={labelCls}>Produkt</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputCls}
              disabled={productsLoading}
            >
              <option value="">
                {productsLoading ? 'Produkte werden geladen...' : 'Kein Produkt'}
              </option>
              {(products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
          </div>

          {/* Notizen */}
          <div>
            <label className={labelCls}>Notizen fuer Creator</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Wichtige Hinweise, Anforderungen, Ideen..."
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Dokumente */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Dokumente (optional)
            </p>

            {/* Briefing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Briefings</label>
                <button type="button" onClick={() => briefingRef.current?.click()} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> PDF hinzufuegen
                </button>
                <input ref={briefingRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setBriefingFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
              </div>
              {briefingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <FileText className="h-3 w-3 text-red-500" />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setBriefingFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>

            {/* Skripte */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Skripte</label>
                <button type="button" onClick={() => skriptRef.current?.click()} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> PDF hinzufuegen
                </button>
                <input ref={skriptRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setSkriptFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
              </div>
              {skriptFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <FileText className="h-3 w-3 text-red-500" />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setSkriptFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>

            {/* Sonstige */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Sonstige Dokumente</label>
                <button type="button" onClick={() => sonstigeRef.current?.click()} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" /> PDF hinzufuegen
                </button>
                <input ref={sonstigeRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setSonstigeFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
              </div>
              {sonstigeFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <FileText className="h-3 w-3 text-red-500" />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setSonstigeFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {uploadStatus && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {uploadStatus}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {createProject.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Projekt anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
