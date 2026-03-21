import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { DownloadCloud, Clock, MapPin } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';

// Mock Data for Revenue Chart
const revenueData = [
    { name: 'Jan', revenue: 120000 },
    { name: 'Feb', revenue: 150000 },
    { name: 'Mar', revenue: 180000 },
    { name: 'Apr', revenue: 160000 },
    { name: 'May', revenue: 210000 },
    { name: 'Jun', revenue: 240000 },
    { name: 'Jul', revenue: 280000 },
];

// Mock Data for Module Usage
const moduleUsage = [
    { module: 'Point of Sale (POS)', usage: 92, color: 'bg-cyan' },
    { module: 'CRM & Customers', usage: 78, color: 'bg-purple' },
    { module: 'Inventory Management', usage: 65, color: 'bg-indigo' },
    { module: 'HR & Payroll', usage: 45, color: 'bg-success' },
];

// Mock Data for Branch Performance
const branchPerformance = [
    { id: 1, name: 'Dubai Main Branch', rev: 'AED 845,000', growth: '+12%', status: 'Excellent' },
    { id: 2, name: 'Abu Dhabi Hub', rev: 'AED 620,000', growth: '+8%', status: 'Good' },
    { id: 3, name: 'Sharjah Outlet', rev: 'AED 210,000', growth: '-2%', status: 'Needs Attention' },
    { id: 4, name: 'Riyadh KSA', rev: 'AED 950,000', growth: '+24%', status: 'Excellent' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 200, damping: 20 }
    }
};

export const AnalyticsScreen: React.FC = () => {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full pb-10"
        >

            {/* Page Header */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-card rounded-[20px] p-6 shadow-sm border border-border">
                <div>
                    <h1 className="font-nunito text-2xl font-black text-midnight">Enterprise Analytics</h1>
                    <p className="text-content-3 text-sm font-medium mt-1">Comprehensive view of your business metrics</p>
                </div>

                <div className="flex gap-3 w-full sm:w-auto shrink-0">
                    <button className="flex-1 sm:flex-none border border-border bg-surface-bg hover:bg-surface-bg-2 transition-colors text-content-2 font-bold text-[0.82rem] px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2">
                        <Clock size={16} /> Schedule Report
                    </button>
                    <button className="flex-1 sm:flex-none bg-midnight hover:bg-[#1a2b4b] transition-colors text-white font-bold text-[0.82rem] px-5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2">
                        <DownloadCloud size={16} className="text-cyan" /> Export Data
                    </button>
                </div>
            </motion.div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Bar Chart */}
                <motion.div variants={itemVariants} className="lg:col-span-2 bg-surface-card rounded-[20px] p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-nunito font-extrabold text-lg text-midnight">Monthly Revenue (AED)</h2>
                        <select className="bg-surface-bg border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-content-2 outline-none cursor-pointer">
                            <option>2024 (YTD)</option>
                            <option>2023</option>
                        </select>
                    </div>

                    <div className="flex-1 w-full" style={{ direction: 'ltr' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8f9bba', fontSize: 12, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8f9bba', fontSize: 12, fontWeight: 600 }}
                                    tickFormatter={(value) => `${value / 1000}k`}
                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,229,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: '#0A192F',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(0,229,255,0.2)',
                                        boxShadow: '0 10px 30px -10px rgba(0,229,255,0.3)',
                                        color: '#fff',
                                        fontWeight: 'bold'
                                    }}
                                    itemStyle={{ color: '#00E5FF' }}
                                    formatter={(value: number | undefined) => [value != null ? `AED ${value.toLocaleString()}` : '', 'Revenue']}
                />
                                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={40}>
                                    {
                                        revenueData.map((_entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                    fill={index === revenueData.length - 1 ? '#00E5FF' : '#E0E7FF'}
                                    className="transition-all duration-300 hover:opacity-80"
                      />
                                    ))
                  }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Module Usage Progress List */}
                <motion.div variants={itemVariants} className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-border flex flex-col">
                    <h2 className="font-nunito font-extrabold text-lg text-midnight mb-6">Module Usage Rates</h2>

                    <div className="flex flex-col gap-6 flex-1 justify-center">
                        {moduleUsage.map((item, idx) => (
                            <div key={idx} className="w-full">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[0.8rem] font-bold text-content">{item.module}</span>
                                    <span className="text-[0.8rem] font-extrabold text-midnight">{item.usage}%</span>
                                </div>
                                <div className="w-full h-2 bg-surface-bg-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.usage}%` }}
                                    transition={{ duration: 1, delay: 0.5 + (idx * 0.1), ease: "easeOut" }}
                                    className={`h-full ${item.color} rounded-full`}
                  />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-border">
                        <p className="text-xs text-content-3 leading-relaxed text-center font-medium">
                            * Based on active daily sessions and transaction volumes across all workspaces.
                        </p>
                    </div>
                </motion.div>

            </div>

            {/* Branch Performance DataGrid */}
            <motion.div variants={itemVariants} className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-border">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo/10 flex items-center justify-center text-indigo">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h2 className="font-nunito font-extrabold text-lg text-midnight">Performance Summary</h2>
                            <p className="text-[0.7rem] text-content-3 font-bold mt-0.5">Metrics broken down by active branches</p>
                        </div>
                    </div>
                    <button className="text-cyan text-sm font-bold hover:text-[#00c5db] transition-colors">
                        View Map
                    </button>
                </div>

                <DataTable
                    data={branchPerformance}
                    columns={[
                        { header: 'Branch Name', accessorKey: 'name', className: 'font-bold text-midnight' },
                        { header: 'Total Revenue', accessorKey: 'rev', className: 'font-bold' },
                        {
                            header: 'Growth',
                            accessorKey: (row) => (
                                <span className={`font-bold ${row.growth.startsWith('+') ? 'text-success' : 'text-danger'}`}>
                {row.growth}
            </span>
            ) 
            },
            {
                header: 'Status', 
              accessorKey: (row) => {
                let variant: any = 'gray';
            if (row.status === 'Excellent') variant = 'green';
            if (row.status === 'Good') variant = 'cyan';
            if (row.status === 'Needs Attention') variant = 'warn';
            return <StatusBadge text={row.status} variant={variant} />;
              } 
            },
          ]}
        />
        </motion.div>

    </motion.div >
  );
};

export default AnalyticsScreen;
