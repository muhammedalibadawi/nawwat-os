import React from 'react';

interface DataTableColumn<T> {
    header: string;
    accessorKey: keyof T | ((row: T) => React.ReactNode);
    className?: string; // e.g., 'text-end' for numbers
}

interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    onRowClick?: (row: T) => void;
    className?: string;
}

export function DataTable<T>({ data, columns, onRowClick, className = '' }: DataTableProps<T>) {
    return (
        <div className={`w-full overflow-x-auto rounded-[12px] border border-border bg-surface-card shadow-sm ${className}`}>
      <table className="w-full text-start border-collapse font-sans min-w-[600px]">
        <thead>
          <tr className="bg-surface-bg-2 border-b border-border">
            {columns.map((col, idx) => (
              <th 
                key={idx}
                className={`px-4 py-3 text-[0.68rem] font-bold text-content-3 uppercase tracking-wider text-start whitespace-nowrap ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-content-4">
                No records found.
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className={`transition-colors duration-200 ${onRowClick ? 'cursor-pointer hover:bg-surface-bg/50' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`px-4 py-3.5 text-[0.82rem] text-content whitespace-nowrap ${col.className || ''}`}
                  >
                    {typeof col.accessorKey === 'function' 
                      ? col.accessorKey(row) 
                      : (row[col.accessorKey] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
