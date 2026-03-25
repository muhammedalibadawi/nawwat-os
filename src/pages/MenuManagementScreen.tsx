import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChefHat, Pencil, PieChart, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { RecipeCostModal } from '@/components/restaurant/RecipeCostModal';
import type {
    RestaurantCategory,
    RestaurantIngredientOption,
    RestaurantMenuItem,
    RestaurantMenuItemForm,
    RestaurantModifierGroup,
    RestaurantModifierGroupForm,
    RestaurantRecipeIngredient,
    RestaurantRecipeSummary,
} from '@/services/restaurantService';
import {
    deleteRestaurantCategory,
    deleteRestaurantMenuItem,
    deleteRestaurantModifierGroup,
    formatRestaurantMoney,
    loadRestaurantBranches,
    loadRestaurantCategories,
    loadRestaurantIngredientOptions,
    loadRestaurantMenu,
    loadRestaurantModifierGroups,
    loadRestaurantRecipeData,
    safeRestaurantErrorMessage,
    saveRestaurantCategory,
    saveRestaurantMenuItem,
    saveRestaurantModifierGroup,
} from '@/services/restaurantService';

type MenuTab = 'items' | 'categories' | 'modifiers' | 'recipes';

const menuTabs: Array<{ id: MenuTab; label: string }> = [
    { id: 'items', label: 'عناصر القائمة' },
    { id: 'categories', label: 'التصنيفات' },
    { id: 'modifiers', label: 'المعدلات' },
    { id: 'recipes', label: 'الوصفات والتكلفة' },
];

const emptyMenuForm: RestaurantMenuItemForm = {
    display_name: '',
    display_name_ar: '',
    description: '',
    image_url: '',
    prep_station: 'main',
    prep_time_minutes: 10,
    price: 0,
    cost_alert_threshold_pct: 30,
    is_available: true,
    is_featured: false,
    sort_order: 0,
    sku: '',
    modifier_groups: [],
    recipe_lines: [],
};

const emptyModifierGroupForm: RestaurantModifierGroupForm = {
    name: '',
    name_ar: '',
    description: '',
    min_select: 0,
    max_select: 1,
    is_required: false,
    is_active: true,
    sort_order: 0,
    modifiers: [],
};

function MenuItemModal(props: {
    open: boolean;
    categories: RestaurantCategory[];
    modifierGroups: RestaurantModifierGroup[];
    ingredientOptions: RestaurantIngredientOption[];
    value: RestaurantMenuItemForm;
    branchId: string;
    saving: boolean;
    onChange: (value: RestaurantMenuItemForm) => void;
    onClose: () => void;
    onSave: () => void;
}) {
    const { open, categories, modifierGroups, ingredientOptions, value, branchId, saving, onChange, onClose, onSave } = props;
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (open) setStep(0);
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#071C3B]/55 p-4" dir="rtl">
            <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">MENU ITEM WIZARD</p>
                        <h2 className="mt-1 text-2xl font-black text-[#071C3B]">{value.id ? 'تعديل صنف' : 'إضافة صنف جديد'}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex gap-2 border-b border-slate-200 px-6 py-4">
                    {['الأساسيات', 'المعدلات', 'الوصفة'].map((label, index) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setStep(index)}
                            className={`rounded-full px-4 py-2 text-sm font-black transition ${
                                step === index ? 'bg-[#071C3B] text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
                    {step === 0 && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم" value={value.display_name} onChange={(event) => onChange({ ...value, display_name: event.target.value })} />
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم العربي" value={value.display_name_ar || ''} onChange={(event) => onChange({ ...value, display_name_ar: event.target.value })} />
                            <select className="rounded-[18px] border border-slate-200 px-4 py-3" value={value.category_id || ''} onChange={(event) => onChange({ ...value, category_id: event.target.value || null })}>
                                <option value="">بدون تصنيف</option>
                                {categories.map((category) => <option key={category.id} value={category.id}>{category.name_ar || category.name}</option>)}
                            </select>
                            <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="السعر" value={value.price} onChange={(event) => onChange({ ...value, price: Number(event.target.value) })} />
                            <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="وقت التحضير" value={value.prep_time_minutes} onChange={(event) => onChange({ ...value, prep_time_minutes: Number(event.target.value) })} />
                            <select className="rounded-[18px] border border-slate-200 px-4 py-3" value={value.prep_station} onChange={(event) => onChange({ ...value, prep_station: event.target.value as RestaurantMenuItemForm['prep_station'] })}>
                                <option value="main">main</option>
                                <option value="cold">cold</option>
                                <option value="bar">bar</option>
                                <option value="grill">grill</option>
                                <option value="dessert">dessert</option>
                            </select>
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3 md:col-span-2" placeholder="SKU" value={value.sku || ''} onChange={(event) => onChange({ ...value, sku: event.target.value })} />
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3 md:col-span-2" placeholder="رابط الصورة" value={value.image_url || ''} onChange={(event) => onChange({ ...value, image_url: event.target.value })} />
                            <textarea className="min-h-32 rounded-[18px] border border-slate-200 px-4 py-3 md:col-span-2" placeholder="الوصف" value={value.description || ''} onChange={(event) => onChange({ ...value, description: event.target.value })} />
                            <div className="rounded-[20px] bg-slate-50 px-4 py-3 md:col-span-2">
                                <p className="text-xs font-bold text-slate-500">نطاق الفرع</p>
                                <div className="mt-3 flex gap-3">
                                    <button type="button" onClick={() => onChange({ ...value, branch_id: null })} className={`rounded-full px-4 py-2 text-sm font-bold ${!value.branch_id ? 'bg-cyan text-[#071C3B]' : 'bg-white text-slate-500'}`}>كل الفروع</button>
                                    <button type="button" onClick={() => onChange({ ...value, branch_id: branchId })} className={`rounded-full px-4 py-2 text-sm font-bold ${value.branch_id === branchId ? 'bg-cyan text-[#071C3B]' : 'bg-white text-slate-500'}`}>الفرع الحالي</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 1 && (
                        <div className="space-y-4">
                            {modifierGroups.map((group) => {
                                const selected = value.modifier_groups.find((entry) => entry.modifier_group_id === group.id);
                                return (
                                    <div key={group.id} className="rounded-[24px] border border-slate-200 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-black text-[#071C3B]">{group.name_ar || group.name}</h3>
                                                <p className="mt-1 text-sm text-slate-500">min {group.min_select} · max {group.max_select}</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selected)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        onChange({
                                                            ...value,
                                                            modifier_groups: [
                                                                ...value.modifier_groups,
                                                                { modifier_group_id: group.id, sort_order: group.sort_order, required_override: null, min_select_override: null, max_select_override: null },
                                                            ],
                                                        });
                                                    } else {
                                                        onChange({ ...value, modifier_groups: value.modifier_groups.filter((entry) => entry.modifier_group_id !== group.id) });
                                                    }
                                                }}
                                            />
                                        </div>
                                        {selected && (
                                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                                <label className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                                                    Required
                                                    <input type="checkbox" className="ms-3" checked={Boolean(selected.required_override)} onChange={(event) => onChange({
                                                        ...value,
                                                        modifier_groups: value.modifier_groups.map((entry) => entry.modifier_group_id === group.id ? { ...entry, required_override: event.target.checked } : entry),
                                                    })} />
                                                </label>
                                                <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Min override" value={selected.min_select_override ?? ''} onChange={(event) => onChange({
                                                    ...value,
                                                    modifier_groups: value.modifier_groups.map((entry) => entry.modifier_group_id === group.id ? { ...entry, min_select_override: event.target.value ? Number(event.target.value) : null } : entry),
                                                })} />
                                                <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Max override" value={selected.max_select_override ?? ''} onChange={(event) => onChange({
                                                    ...value,
                                                    modifier_groups: value.modifier_groups.map((entry) => entry.modifier_group_id === group.id ? { ...entry, max_select_override: event.target.value ? Number(event.target.value) : null } : entry),
                                                })} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-4">
                            {value.recipe_lines.map((line, index) => (
                                <div key={`${line.ingredient_id}-${index}`} className="grid gap-3 rounded-[24px] border border-slate-200 p-4 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr_auto]">
                                    <select className="rounded-[18px] border border-slate-200 px-4 py-3" value={line.ingredient_id} onChange={(event) => onChange({
                                        ...value,
                                        recipe_lines: value.recipe_lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, ingredient_id: event.target.value } : entry),
                                    })}>
                                        <option value="">اختر مكوّنًا</option>
                                        {ingredientOptions.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name_ar || ingredient.name}</option>)}
                                    </select>
                                    <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الكمية" value={line.quantity} onChange={(event) => onChange({
                                        ...value,
                                        recipe_lines: value.recipe_lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry),
                                    })} />
                                    <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Cost" value={line.cost_snapshot ?? 0} onChange={(event) => onChange({
                                        ...value,
                                        recipe_lines: value.recipe_lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, cost_snapshot: Number(event.target.value) } : entry),
                                    })} />
                                    <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Waste %" value={line.waste_pct ?? 0} onChange={(event) => onChange({
                                        ...value,
                                        recipe_lines: value.recipe_lines.map((entry, entryIndex) => entryIndex === index ? { ...entry, waste_pct: Number(event.target.value) } : entry),
                                    })} />
                                    <button type="button" onClick={() => onChange({ ...value, recipe_lines: value.recipe_lines.filter((_, entryIndex) => entryIndex !== index) })} className="rounded-[18px] bg-rose-50 px-4 py-3 text-rose-500">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => onChange({
                                ...value,
                                recipe_lines: [...value.recipe_lines, { ingredient_id: '', quantity: 1, cost_snapshot: 0, waste_pct: 0, sort_order: value.recipe_lines.length }],
                            })} className="inline-flex items-center gap-2 rounded-[18px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
                                <Plus size={16} />
                                إضافة مكوّن
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-between border-t border-slate-200 px-6 py-5">
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500">
                            السابق
                        </button>
                        <button type="button" onClick={() => setStep((current) => Math.min(current + 1, 2))} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500">
                            التالي
                        </button>
                    </div>
                    <button type="button" disabled={saving || !value.display_name.trim()} onClick={onSave} className="inline-flex items-center gap-2 rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B] disabled:opacity-50">
                        <Save size={16} />
                        {saving ? 'جارٍ الحفظ...' : 'حفظ الصنف'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModifierGroupModal(props: {
    open: boolean;
    value: RestaurantModifierGroupForm;
    saving: boolean;
    onChange: (value: RestaurantModifierGroupForm) => void;
    onClose: () => void;
    onSave: () => void;
}) {
    const { open, value, saving, onChange, onClose, onSave } = props;
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#071C3B]/55 p-4" dir="rtl">
            <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <h2 className="text-2xl font-black text-[#071C3B]">{value.id ? 'تعديل مجموعة معدلات' : 'مجموعة معدلات جديدة'}</h2>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
                </div>
                <div className="space-y-4 px-6 py-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
                        <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم العربي" value={value.name_ar || ''} onChange={(event) => onChange({ ...value, name_ar: event.target.value })} />
                        <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Min" value={value.min_select} onChange={(event) => onChange({ ...value, min_select: Number(event.target.value) })} />
                        <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="Max" value={value.max_select} onChange={(event) => onChange({ ...value, max_select: Number(event.target.value) })} />
                    </div>
                    <textarea className="min-h-24 w-full rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الوصف" value={value.description || ''} onChange={(event) => onChange({ ...value, description: event.target.value })} />
                    <div className="space-y-3">
                        {value.modifiers.map((modifier, index) => (
                            <div key={modifier.id || index} className="grid gap-3 rounded-[24px] border border-slate-200 p-4 md:grid-cols-[1fr_1fr_0.7fr_auto]">
                                <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="اسم المعدل" value={modifier.name} onChange={(event) => onChange({ ...value, modifiers: value.modifiers.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry) })} />
                                <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم العربي" value={modifier.name_ar || ''} onChange={(event) => onChange({ ...value, modifiers: value.modifiers.map((entry, entryIndex) => entryIndex === index ? { ...entry, name_ar: event.target.value } : entry) })} />
                                <input type="number" className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="السعر" value={modifier.price_delta} onChange={(event) => onChange({ ...value, modifiers: value.modifiers.map((entry, entryIndex) => entryIndex === index ? { ...entry, price_delta: Number(event.target.value) } : entry) })} />
                                <button type="button" onClick={() => onChange({ ...value, modifiers: value.modifiers.filter((_, entryIndex) => entryIndex !== index) })} className="rounded-[18px] bg-rose-50 px-4 py-3 text-rose-500">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => onChange({
                            ...value,
                            modifiers: [...value.modifiers, { name: '', name_ar: '', price_delta: 0, cost_delta: 0, prep_station: null, is_default: false, is_active: true, sort_order: value.modifiers.length }],
                        })} className="inline-flex items-center gap-2 rounded-[18px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
                            <Plus size={16} />
                            إضافة معدل
                        </button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button type="button" onClick={onClose} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500">إغلاق</button>
                    <button type="button" disabled={saving || !value.name.trim()} onClick={onSave} className="rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B] disabled:opacity-50">
                        {saving ? 'جارٍ الحفظ...' : 'حفظ المجموعة'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function MenuManagementScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<MenuTab>('items');
    const [branchId, setBranchId] = useState('');
    const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar: string | null }>>([]);
    const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
    const [categories, setCategories] = useState<RestaurantCategory[]>([]);
    const [modifierGroups, setModifierGroups] = useState<RestaurantModifierGroup[]>([]);
    const [ingredientOptions, setIngredientOptions] = useState<RestaurantIngredientOption[]>([]);
    const [recipeSummaries, setRecipeSummaries] = useState<RestaurantRecipeSummary[]>([]);
    const [ingredientsByItemId, setIngredientsByItemId] = useState<Record<string, RestaurantRecipeIngredient[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [menuModalOpen, setMenuModalOpen] = useState(false);
    const [menuForm, setMenuForm] = useState<RestaurantMenuItemForm>(emptyMenuForm);
    const [modifierModalOpen, setModifierModalOpen] = useState(false);
    const [modifierForm, setModifierForm] = useState<RestaurantModifierGroupForm>(emptyModifierGroupForm);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [categoryForm, setCategoryForm] = useState<Partial<RestaurantCategory>>({ name: '', name_ar: '', sort_order: 0, is_active: true });
    const [recipeModalItemId, setRecipeModalItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.tenant_id) return;
        let cancelled = false;
        const tenantId = user.tenant_id;
        const defaultBranchId = user.branch_id;

        async function loadData() {
            setLoading(true);
            setError('');
            try {
                const nextBranches = await loadRestaurantBranches(tenantId);
                const resolvedBranchId = branchId || defaultBranchId || nextBranches[0]?.id || '';
                const [nextMenuItems, nextCategories, nextModifierGroups, nextIngredientOptions] = await Promise.all([
                    resolvedBranchId ? loadRestaurantMenu(tenantId, resolvedBranchId) : Promise.resolve([]),
                    loadRestaurantCategories(tenantId),
                    loadRestaurantModifierGroups(tenantId),
                    loadRestaurantIngredientOptions(tenantId),
                ]);
                const recipeData = await loadRestaurantRecipeData(tenantId, nextMenuItems);
                if (cancelled) return;
                setBranches(nextBranches);
                setBranchId(resolvedBranchId);
                setMenuItems(nextMenuItems);
                setCategories(nextCategories);
                setModifierGroups(nextModifierGroups);
                setIngredientOptions(nextIngredientOptions);
                setRecipeSummaries(recipeData.summaries);
                setIngredientsByItemId(recipeData.ingredientsByItemId);
            } catch (loadError) {
                if (!cancelled) setError(safeRestaurantErrorMessage(loadError, 'تعذر تحميل إدارة القائمة'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadData();
        return () => {
            cancelled = true;
        };
    }, [branchId, refreshTick, user?.branch_id, user?.tenant_id]);

    const activeRecipeSummary = useMemo(
        () => recipeSummaries.find((summary) => summary.item_id === recipeModalItemId) ?? null,
        [recipeModalItemId, recipeSummaries]
    );

    const openEditMenuItem = (item: RestaurantMenuItem) => {
        const recipeLines = (ingredientsByItemId[item.item_id] ?? []).map((ingredient, index) => ({
            ingredient_id: ingredient.ingredient_id,
            quantity: ingredient.quantity,
            cost_snapshot: ingredient.cost_snapshot,
            waste_pct: ingredient.waste_pct,
            sort_order: index,
        }));
        setMenuForm({
            id: item.id,
            item_id: item.item_id,
            branch_id: item.branch_id,
            category_id: item.category_id,
            display_name: item.display_name,
            display_name_ar: item.display_name_ar || '',
            description: item.description || '',
            image_url: item.image_url || '',
            prep_station: item.prep_station,
            prep_time_minutes: item.prep_time_minutes,
            price: item.price,
            cost_alert_threshold_pct: item.cost_alert_threshold_pct ?? 30,
            is_available: item.is_available,
            is_featured: item.is_featured,
            sort_order: item.sort_order,
            sku: '',
            modifier_groups: item.modifier_groups.map((group, index) => ({
                modifier_group_id: group.id,
                required_override: group.required_override,
                min_select_override: group.min_select_override,
                max_select_override: group.max_select_override,
                sort_order: index,
            })),
            recipe_lines: recipeLines,
        });
        setMenuModalOpen(true);
    };

    const handleSaveMenuItem = async () => {
        const tenantId = user?.tenant_id;
        if (!tenantId) return;
        setSaving(true);
        setError('');
        try {
            await saveRestaurantMenuItem(tenantId, menuForm);
            setSuccess(menuForm.id ? 'تم تحديث الصنف بنجاح.' : 'تمت إضافة الصنف بنجاح.');
            setMenuModalOpen(false);
            setMenuForm(emptyMenuForm);
            setRefreshTick((value) => value + 1);
        } catch (saveError) {
            setError(safeRestaurantErrorMessage(saveError, 'تعذر حفظ الصنف'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCategory = async () => {
        const tenantId = user?.tenant_id;
        if (!tenantId || !categoryForm.name) return;
        setSaving(true);
        setError('');
        try {
            await saveRestaurantCategory(tenantId, categoryForm as Partial<RestaurantCategory> & { name: string });
            setSuccess(categoryForm.id ? 'تم تحديث التصنيف.' : 'تم إنشاء التصنيف.');
            setCategoryModalOpen(false);
            setCategoryForm({ name: '', name_ar: '', sort_order: categories.length, is_active: true });
            setRefreshTick((value) => value + 1);
        } catch (saveError) {
            setError(safeRestaurantErrorMessage(saveError, 'تعذر حفظ التصنيف'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveModifierGroup = async () => {
        const tenantId = user?.tenant_id;
        if (!tenantId) return;
        setSaving(true);
        setError('');
        try {
            await saveRestaurantModifierGroup(tenantId, modifierForm);
            setSuccess(modifierForm.id ? 'تم تحديث مجموعة المعدلات.' : 'تمت إضافة مجموعة معدلات جديدة.');
            setModifierModalOpen(false);
            setModifierForm(emptyModifierGroupForm);
            setRefreshTick((value) => value + 1);
        } catch (saveError) {
            setError(safeRestaurantErrorMessage(saveError, 'تعذر حفظ مجموعة المعدلات'));
        } finally {
            setSaving(false);
        }
    };

    const menuColumns = [
        { header: 'الصورة / الاسم', accessorKey: (row: RestaurantMenuItem) => (
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#071C3B] text-cyan">
                    <ChefHat size={18} />
                </div>
                <div>
                    <div className="font-black text-[#071C3B]">{row.display_name_ar || row.display_name}</div>
                    <div className="text-xs text-slate-500">{row.category_name_ar || row.category_name || 'بدون تصنيف'}</div>
                </div>
            </div>
        )},
        { header: 'السعر', accessorKey: (row: RestaurantMenuItem) => formatRestaurantMoney(row.price) },
        { header: 'التكلفة', accessorKey: (row: RestaurantMenuItem) => formatRestaurantMoney(row.cost) },
        { header: 'الهامش', accessorKey: (row: RestaurantMenuItem) => `${row.margin_pct?.toFixed(1) ?? '0.0'}%` },
        { header: 'Prep', accessorKey: (row: RestaurantMenuItem) => `${row.prep_time_minutes} د` },
        { header: 'متاح؟', accessorKey: (row: RestaurantMenuItem) => row.is_available ? 'نعم' : 'لا' },
        { header: 'إجراءات', accessorKey: (row: RestaurantMenuItem) => (
            <div className="flex gap-2">
                <button type="button" onClick={(event) => { event.stopPropagation(); openEditMenuItem(row); }} className="rounded-full bg-cyan/10 p-2 text-[#071C3B]"><Pencil size={14} /></button>
                <button type="button" onClick={async (event) => {
                    event.stopPropagation();
                    const tenantId = user?.tenant_id;
                    if (!tenantId || !window.confirm('هل تريد حذف هذا الصنف؟')) return;
                    try {
                        await deleteRestaurantMenuItem(tenantId, row.id);
                        setSuccess('تم حذف الصنف.');
                        setRefreshTick((value) => value + 1);
                    } catch (deleteError) {
                        setError(safeRestaurantErrorMessage(deleteError, 'تعذر حذف الصنف'));
                    }
                }} className="rounded-full bg-rose-50 p-2 text-rose-500"><Trash2 size={14} /></button>
            </div>
        )},
    ];

    return (
            <div className="space-y-6 p-6" dir="rtl">
                <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-[#071C3B]">Menu Management</h1>
                    <p className="mt-2 text-sm text-slate-500">إدارة أصناف المطعم، التصنيفات، المعدلات، والوصفات مع حساب التكلفة والهوامش.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {branches.length > 0 ? (
                        <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar || branch.name}</option>)}
                        </select>
                    ) : (
                        <span className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">لا يوجد فرع نشط</span>
                    )}
                    <button type="button" onClick={() => {
                        setMenuForm({ ...emptyMenuForm, branch_id: branchId, sort_order: menuItems.length });
                        setMenuModalOpen(true);
                    }} className="inline-flex items-center gap-2 rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B]">
                        <Plus size={16} />
                        صنف جديد
                    </button>
                </div>
            </div>

            {(error || success) && (
                <div className="mt-4 space-y-2">
                    {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}
                    {success ? <StatusBanner variant="success">{success}</StatusBanner> : null}
                </div>
            )}

            {!loading && branches.length === 0 && (
                <StatusBanner variant="warning">
                    السبب: لا يوجد فرع نشط للمستأجر الحالي، لذلك لن تظهر أصناف القائمة المرتبطة بالفرع. التصنيفات والمعدلات تظهر لجميع الفروع.
                </StatusBanner>
            )}

            <div className="flex flex-wrap gap-2 rounded-[24px] bg-white p-2 shadow-sm">
                {menuTabs.map((tab) => (
                    <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-[18px] px-4 py-3 text-sm font-black transition ${activeTab === tab.id ? 'bg-[#071C3B] text-white' : 'bg-slate-50 text-slate-500'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center text-slate-500">جارٍ تحميل قطاع المطاعم...</div>
            ) : activeTab === 'items' ? (
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    {branchId && menuItems.length === 0 ? (
                        <div className="mb-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            السبب: لا توجد أصناف لهذا الفرع في التبويب الحالي بعد. أضف صنفًا جديدًا، أو إن وُضعت بذور التجربة على فرع آخر فاختره من القائمة أعلاه.
                        </div>
                    ) : null}
                    <DataTable
                        data={menuItems}
                        columns={menuColumns}
                        emptyMessage="السبب: لا توجد أصناف قائمة لهذا الفرع في العرض الحالي بعد."
                    />
                </div>
            ) : activeTab === 'categories' ? (
                <div className="space-y-4">
                    {!loading && categories.length === 0 ? (
                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            السبب: لا توجد تصنيفات قائمة لهذا المستأجر ونوع «menu» بعد. أنشئ تصنيفًا بالزر «تصنيف جديد» — التصنيفات مرتبطة بالمستأجر وليست مقتصرة على فرع واحد.
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {categories.map((category, index) => (
                        <article key={category.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-[#071C3B]">{category.name_ar || category.name}</h3>
                                    <p className="mt-1 text-sm text-slate-500">display order: {category.sort_order}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setCategoryForm(category); setCategoryModalOpen(true); }} className="rounded-full bg-cyan/10 p-2 text-[#071C3B]"><Pencil size={14} /></button>
                                    <button type="button" onClick={async () => {
                                        const tenantId = user?.tenant_id;
                                        if (!tenantId || !window.confirm('حذف التصنيف؟')) return;
                                        try {
                                            await deleteRestaurantCategory(tenantId, category.id);
                                            setSuccess('تم حذف التصنيف.');
                                            setRefreshTick((value) => value + 1);
                                        } catch (deleteError) {
                                            setError(safeRestaurantErrorMessage(deleteError, 'تعذر حذف التصنيف'));
                                        }
                                    }} className="rounded-full bg-rose-50 p-2 text-rose-500"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div className="mt-5 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button type="button" disabled={index === 0} onClick={async () => {
                                        const tenantId = user?.tenant_id;
                                        if (!tenantId || index === 0) return;
                                        const above = categories[index - 1];
                                        await saveRestaurantCategory(tenantId, { ...category, sort_order: above.sort_order });
                                        await saveRestaurantCategory(tenantId, { ...above, sort_order: category.sort_order });
                                        setRefreshTick((value) => value + 1);
                                    }} className="rounded-full bg-slate-100 p-2 text-slate-500 disabled:opacity-40"><ChevronRight size={16} /></button>
                                    <button type="button" disabled={index === categories.length - 1} onClick={async () => {
                                        const tenantId = user?.tenant_id;
                                        if (!tenantId || index === categories.length - 1) return;
                                        const below = categories[index + 1];
                                        await saveRestaurantCategory(tenantId, { ...category, sort_order: below.sort_order });
                                        await saveRestaurantCategory(tenantId, { ...below, sort_order: category.sort_order });
                                        setRefreshTick((value) => value + 1);
                                    }} className="rounded-full bg-slate-100 p-2 text-slate-500 disabled:opacity-40"><ChevronLeft size={16} /></button>
                                </div>
                                <button type="button" onClick={() => { setCategoryForm({ name: '', name_ar: '', sort_order: categories.length, is_active: true }); setCategoryModalOpen(true); }} className="rounded-[18px] bg-cyan px-4 py-2 text-sm font-black text-[#071C3B]">إضافة</button>
                            </div>
                        </article>
                    ))}
                    <button type="button" onClick={() => { setCategoryForm({ name: '', name_ar: '', sort_order: categories.length, is_active: true }); setCategoryModalOpen(true); }} className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
                        <Plus className="mx-auto mb-3 h-8 w-8 text-cyan" />
                        <p className="font-black">تصنيف جديد</p>
                    </button>
                    </div>
                </div>
            ) : activeTab === 'modifiers' ? (
                <div className="space-y-4">
                    {!loading && modifierGroups.length === 0 ? (
                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            السبب: لا توجد مجموعات معدلات لهذا المستأجر بعد. أضف مجموعة ثم اربطها بالأصناف من نموذج «صنف جديد/تعديل». المعدلات مشتركة على مستوى المستأجر.
                        </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                    {modifierGroups.map((group) => (
                        <article key={group.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-[#071C3B]">{group.name_ar || group.name}</h3>
                                    <p className="mt-1 text-sm text-slate-500">min {group.min_select} · max {group.max_select}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => {
                                        setModifierForm({ id: group.id, name: group.name, name_ar: group.name_ar || '', description: group.description || '', min_select: group.min_select, max_select: group.max_select, is_required: group.is_required, is_active: group.is_active, sort_order: group.sort_order, modifiers: group.modifiers.map((modifier) => ({ id: modifier.id, name: modifier.name, name_ar: modifier.name_ar || '', price_delta: modifier.price_delta, cost_delta: modifier.cost_delta, prep_station: modifier.prep_station, is_default: modifier.is_default, is_active: modifier.is_active, sort_order: modifier.sort_order })) });
                                        setModifierModalOpen(true);
                                    }} className="rounded-full bg-cyan/10 p-2 text-[#071C3B]"><Pencil size={14} /></button>
                                    <button type="button" onClick={async () => {
                                        const tenantId = user?.tenant_id;
                                        if (!tenantId || !window.confirm('حذف المجموعة؟')) return;
                                        try {
                                            await deleteRestaurantModifierGroup(tenantId, group.id);
                                            setSuccess('تم حذف المجموعة.');
                                            setRefreshTick((value) => value + 1);
                                        } catch (deleteError) {
                                            setError(safeRestaurantErrorMessage(deleteError, 'تعذر حذف المجموعة'));
                                        }
                                    }} className="rounded-full bg-rose-50 p-2 text-rose-500"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {group.modifiers.map((modifier) => (
                                    <span key={modifier.id} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                                        {modifier.name_ar || modifier.name} · {formatRestaurantMoney(modifier.price_delta)}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                    <button type="button" onClick={() => { setModifierForm({ ...emptyModifierGroupForm, sort_order: modifierGroups.length }); setModifierModalOpen(true); }} className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
                        <Plus className="mx-auto mb-3 h-8 w-8 text-cyan" />
                        <p className="font-black">مجموعة معدلات جديدة</p>
                    </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {!loading && recipeSummaries.length === 0 ? (
                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            السبب: لا توجد وصفات/تحليل تكلفة للأصناف الحالية بعد. يظهر هذا التبويب بعد وجود أصناف قائمة مرتبطة بوصفات في النظام؛ ابدأ من «عناصر القائمة» أو تحقق من ربط الـ item بالوصفة.
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {recipeSummaries.map((summary) => (
                        <article key={summary.recipe_id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-[#071C3B]">{summary.recipe_name}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{summary.ingredient_count} مكوّن</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-black ${summary.over_threshold ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {summary.food_cost_pct?.toFixed(1) ?? '0.0'}%
                                </span>
                            </div>
                            <div className="mt-5 grid gap-3 text-sm text-slate-500">
                                <div className="flex items-center justify-between"><span>التكلفة</span><span className="font-black text-[#071C3B]">{formatRestaurantMoney(summary.cost)}</span></div>
                                <div className="flex items-center justify-between"><span>سعر البيع</span><span className="font-black text-[#071C3B]">{formatRestaurantMoney(summary.selling_price)}</span></div>
                                <div className="flex items-center justify-between"><span>السعر المقترح</span><span className="font-black text-cyan">{formatRestaurantMoney(summary.suggested_price ?? 0)}</span></div>
                            </div>
                            <button type="button" onClick={() => setRecipeModalItemId(summary.item_id)} className="mt-5 inline-flex items-center gap-2 rounded-[18px] bg-[#071C3B] px-4 py-3 text-sm font-black text-white">
                                <PieChart size={16} />
                                فتح التحليل
                            </button>
                        </article>
                    ))}
                    </div>
                </div>
            )}

            <MenuItemModal open={menuModalOpen} categories={categories} modifierGroups={modifierGroups} ingredientOptions={ingredientOptions} value={menuForm} branchId={branchId} saving={saving} onChange={setMenuForm} onClose={() => setMenuModalOpen(false)} onSave={handleSaveMenuItem} />
            <ModifierGroupModal open={modifierModalOpen} value={modifierForm} saving={saving} onChange={setModifierForm} onClose={() => setModifierModalOpen(false)} onSave={handleSaveModifierGroup} />

            {categoryModalOpen && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#071C3B]/55 p-4" dir="rtl">
                    <div className="w-full max-w-xl rounded-[32px] bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                            <h2 className="text-2xl font-black text-[#071C3B]">{categoryForm.id ? 'تعديل تصنيف' : 'تصنيف جديد'}</h2>
                            <button type="button" onClick={() => setCategoryModalOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
                        </div>
                        <div className="grid gap-4 px-6 py-6">
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم" value={categoryForm.name || ''} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="الاسم العربي" value={categoryForm.name_ar || ''} onChange={(event) => setCategoryForm({ ...categoryForm, name_ar: event.target.value })} />
                            <input className="rounded-[18px] border border-slate-200 px-4 py-3" placeholder="اللون" value={categoryForm.color || ''} onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })} />
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                            <button type="button" onClick={() => setCategoryModalOpen(false)} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500">إغلاق</button>
                            <button type="button" disabled={saving || !categoryForm.name} onClick={handleSaveCategory} className="rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B] disabled:opacity-50">
                                {saving ? 'جارٍ الحفظ...' : 'حفظ التصنيف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <RecipeCostModal open={Boolean(recipeModalItemId && activeRecipeSummary)} summary={activeRecipeSummary} ingredients={recipeModalItemId ? (ingredientsByItemId[recipeModalItemId] ?? []) : []} onClose={() => setRecipeModalItemId(null)} />
        </div>
    );
}
