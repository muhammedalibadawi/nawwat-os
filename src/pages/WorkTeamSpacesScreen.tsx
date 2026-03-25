import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { WorkTeamSpace, WorkTeamSpaceFormInput } from '@/types/workos';
import { createTeamSpace, loadTeamSpaces, updateTeamSpace } from '@/services/workosService';
import { isWorkAdminRole, normalizeWorkOsError } from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import TeamSpaceCard from '@/components/workos/TeamSpaceCard';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import TeamSpaceModal from '@/components/workos/TeamSpaceModal';
import { StatusBanner } from '@/components/ui/StatusBanner';

const WorkTeamSpacesScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [spaces, setSpaces] = useState<WorkTeamSpace[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<WorkTeamSpace | null>(null);

  const canManage = isWorkAdminRole(user?.role);

  const reload = async (tenantId: string) => {
    setLoading(true);
    setError('');
    try {
      const nextSpaces = await loadTeamSpaces(tenantId);
      setSpaces(nextSpaces);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل مساحات الفرق.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void reload(user.tenant_id);
  }, [user?.tenant_id]);

  const handleSave = async (value: WorkTeamSpaceFormInput) => {
    if (!user?.tenant_id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (editingSpace) {
        await updateTeamSpace(user.tenant_id, editingSpace.id, value);
        setSuccess('تم تحديث مساحة الفريق بنجاح.');
      } else {
        await createTeamSpace(user.tenant_id, value);
        setSuccess('تم إنشاء مساحة الفريق الجديدة بنجاح.');
      }
      setModalOpen(false);
      setEditingSpace(null);
      await reload(user.tenant_id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ مساحة الفريق.'));
    } finally {
      setSubmitting(false);
    }
  };

  const initialValue = editingSpace
    ? {
        name: editingSpace.name,
        slug: editingSpace.slug ?? '',
        description: editingSpace.description ?? '',
        visibility: editingSpace.visibility,
        is_default: editingSpace.is_default,
        is_active: !editingSpace.is_archived,
        color: editingSpace.color,
      }
    : null;

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="مساحات الفرق"
        subtitle="إدارة المساحات الأساسية التي تجمع مشاريع WorkOS ومستنداته وقنواته داخل نفس الـ tenant."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                setEditingSpace(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <Plus size={16} />
              مساحة جديدة
            </button>
          ) : null
        }
      />

      {(success || error) && (
        <div className="mt-4 space-y-2">
          {success ? <StatusBanner variant="success" className="rounded-2xl">{success}</StatusBanner> : null}
          {error ? <StatusBanner variant="error" className="rounded-2xl">{error}</StatusBanner> : null}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : spaces.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {spaces.map((space) => (
            <TeamSpaceCard
              key={space.id}
              teamSpace={space}
              canManage={canManage}
              onEdit={(selectedSpace) => {
                setEditingSpace(selectedSpace);
                setModalOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <WorkEmptyState
          title="لا توجد مساحات فرق بعد"
          description="السبب: لا توجد مساحات فريق مهيأة في tenant الحالي بعد. بمجرد إنشاء مساحة فريق وربط المشاريع أو القنوات بها ستبدأ هذه الشاشة بعرضها هنا."
        />
      )}

      <TeamSpaceModal
        open={modalOpen}
        mode={editingSpace ? 'edit' : 'create'}
        initialValue={initialValue}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          setEditingSpace(null);
        }}
        onSubmit={handleSave}
      />
    </div>
  );
};

export default WorkTeamSpacesScreen;
