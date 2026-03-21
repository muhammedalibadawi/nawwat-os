import React from 'react';
import { PackageSearch } from 'lucide-react';

export default function ProcurementScreen() {
    return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-gray-500 font-nunito">
            <PackageSearch size={64} className="mb-4 text-gray-300" />
            <h1 className="text-2xl font-extrabold text-[#0A192F]">Procurement Engine</h1>
            <p className="mt-2 text-sm font-semibold">Supply chain and vendor management module is being initialized.</p>
        </div>
    );
}
