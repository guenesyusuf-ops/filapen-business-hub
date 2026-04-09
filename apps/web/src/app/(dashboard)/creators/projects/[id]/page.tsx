'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  Users,
  Edit,
  Trash2,
  Plus,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from '@/hooks/creators/useProjects';
import { useCreators } from '@/hooks/creators/useCreators';

// ---------------------------------------------------------------------------
// Project Detail Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: project, isLoading } = useProject(id);
  const { data: creatorsData } = useCreators({ pageSize: 100 });
  const updateProject = useUpdateProject();
  const deleteProjectMut = useDeleteProject();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [showAddCreator, setShowAddCreator] = useState(false);

  const handleEdit = useCallback(() => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || '');
    setEditDeadline(project.deadline || '');
    setEditStatus(project.status);
    setEditing(true);
  }, [project]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    await updateProject.mutateAsync({
      id: project.id,
      data: {
        name: editName,
        description: editDesc || undefined,
        deadline: editDeadline || undefined,
        status: editStatus,
      },
    });
    setEditing(false);
  }, [project, editName, editDesc, editDeadline, editStatus, updateProject]);

  const handleDelete = useCallback(async () => {
    if (!project || !confirm('Delete this project?')) return;
    await deleteProjectMut.mutateAsync(project.id);
    router.push('/creators/projects');
  }, [project, deleteProjectMut, router]);

  const handleAddCreator = useCallback(
    async (creatorId: string) => {
      if (!project) return;
      const newIds = [...project.creatorIds, creatorId];
      await updateProject.mutateAsync({
        id: project.id,
        data: { creatorIds: newIds },
      });
      setShowAddCreator(false);
    },
    [project, updateProject],
  );

  const handleRemoveCreator = useCallback(
    async (creatorId: string) => {
      if (!project) return;
      const newIds = project.creatorIds.filter((cid) => cid !== creatorId);
      await updateProject.mutateAsync({
        id: project.id,
        data: { creatorIds: newIds },
      });
    },
    [project, updateProject],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-24 rounded bg-gray-200" />
        <div className="rounded-xl bg-white p-6 shadow-card">
          <div className="h-6 w-60 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-80 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">Project not found</p>
        <button
          onClick={() => router.push('/creators/projects')}
          className="mt-3 text-sm text-purple-600 hover:underline"
        >
          Back to projects
        </button>
      </div>
    );
  }

  const allCreators = creatorsData?.data ?? [];
  const availableCreators = allCreators.filter(
    (c) => !project.creatorIds.includes(c.id),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/creators/projects')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Projects
      </button>

      {/* Header Card */}
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-semibold text-gray-900 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              ) : (
                <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
              )}
              <div className="flex items-center gap-3 mt-1">
                {editing ? (
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="text-xs rounded border border-gray-200 px-2 py-1"
                  >
                    {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: PROJECT_STATUS_COLORS[project.status] || '#6B7280' }}
                  >
                    {PROJECT_STATUS_LABELS[project.status] || project.status}
                  </span>
                )}
                {project.deadline && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {editing ? (
                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5"
                      />
                    ) : (
                      new Date(project.deadline).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          {editing ? (
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Project description..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          ) : project.description ? (
            <p className="text-sm text-gray-600">{project.description}</p>
          ) : (
            <p className="text-sm text-gray-400">No description</p>
          )}
        </div>
      </div>

      {/* Assigned Creators */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-purple-600" />
            Assigned Creators ({project.creators?.length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddCreator(!showAddCreator)}
            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Creator
          </button>
        </div>

        {/* Add creator dropdown */}
        {showAddCreator && (
          <div className="border-b border-gray-100 px-5 py-3 bg-gray-50 max-h-48 overflow-y-auto">
            {availableCreators.length === 0 ? (
              <p className="text-xs text-gray-400">All creators are already assigned</p>
            ) : (
              <div className="space-y-1">
                {availableCreators.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAddCreator(c.id)}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-white transition-colors"
                  >
                    <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <span>{c.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{c.handle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Creator list */}
        {!project.creators || project.creators.length === 0 ? (
          <div className="text-center py-10">
            <UserCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No creators assigned</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {project.creators.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => router.push(`/creators/list/${c.id}`)}
                >
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.handle} - {c.platform}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveCreator(c.id)}
                  className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors"
                  title="Remove from project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
