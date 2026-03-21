import { useState, useEffect } from "react";
// import api from "@/api/client"; // Removed until endpoint is ready
import { Loader2, CalendarIcon } from "lucide-react";

interface CustomField {
    id: string;
    entity_type: string;
    name: string;
    key: string;
    field_type: "text" | "number" | "date" | "boolean" | "select";
    options: string | null;
    is_required: number;
}

interface DynamicFormProps {
    entityType: string;
    initialData?: Record<string, any>;
    onSave: (data: Record<string, any>) => void;
    isSubmitting?: boolean;
}

export default function DynamicForm({ entityType, initialData = {}, onSave, isSubmitting = false }: DynamicFormProps) {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch the tenant's custom fields for this entity type
        // The API route would theoretically be: /api/v1/custom-fields/{entityType}
        const fetchFields = async () => {
            try {
                // Simulate an API call while backend gets the endpoint written
                // const res = await api.get(`/custom-fields/${entityType}`);
                // setFields(res.data);

                // MOCK DATA for immediate UI engine functionality
                setTimeout(() => {
                    const mockFields: CustomField[] = entityType === 'RealEstate' ? [
                        { id: '1', entity_type: 'RealEstate', name: 'Square Meters', key: 'sqm', field_type: 'number', options: null, is_required: 1 },
                        { id: '2', entity_type: 'RealEstate', name: 'Zoning Code', key: 'zoning', field_type: 'select', options: '["Residential", "Commercial", "Mixed-Use"]', is_required: 0 },
                    ] : [
                        { id: '3', entity_type: 'Product', name: 'Expiry Date', key: 'expiry', field_type: 'date', options: null, is_required: 0 },
                        { id: '4', entity_type: 'Product', name: 'Batch Code', key: 'batch', field_type: 'text', options: null, is_required: 1 },
                    ];
                    setFields(mockFields);
                    setLoading(false);
                }, 400);

            } catch (err) {
                console.error("Failed to fetch custom fields", err);
                setLoading(false);
            }
        };
        fetchFields();
    }, [entityType]);

    const handleInput = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (fields.length === 0) {
        return <div className="text-sm text-gray-500 italic py-4">No custom fields defined for {entityType}.</div>;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {fields.map(field => {
                    const value = formData[field.key] || "";

                    return (
                        <div key={field.id} className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                {field.name}
                                {field.is_required === 1 && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {field.field_type === 'text' && (
                                <input
                                    type="text"
                                    required={field.is_required === 1}
                                    value={value}
                                    onChange={(e) => handleInput(field.key, e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                                    placeholder={`Enter ${field.name.toLowerCase()}`}
                                />
                            )}

                            {field.field_type === 'number' && (
                                <input
                                    type="number"
                                    required={field.is_required === 1}
                                    value={value}
                                    onChange={(e) => handleInput(field.key, e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                                />
                            )}

                            {field.field_type === 'date' && (
                                <div className="relative">
                                    <input
                                        type="date"
                                        required={field.is_required === 1}
                                        value={value}
                                        onChange={(e) => handleInput(field.key, e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                                    />
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                </div>
                            )}

                            {field.field_type === 'select' && field.options && (
                                <select
                                    required={field.is_required === 1}
                                    value={value}
                                    onChange={(e) => handleInput(field.key, e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                                >
                                    <option value="" disabled>Select {field.name}</option>
                                    {JSON.parse(field.options).map((opt: string) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}

                            {field.field_type === 'boolean' && (
                                <label className="flex items-center gap-3 cursor-pointer py-2">
                                    <input
                                        type="checkbox"
                                        checked={value === true || value === "true"}
                                        onChange={(e) => handleInput(field.key, e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Enable {field.name}</span>
                                </label>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="pt-4 flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Custom Data
                </button>
            </div>
        </form>
    );
}
