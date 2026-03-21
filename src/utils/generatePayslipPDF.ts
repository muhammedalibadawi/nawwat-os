import pdfMake from 'pdfmake/build/pdfmake';

export async function generatePayslipPDF(payslip: any, employee: any, tenant: any) {
    const basic = Number(payslip?.basic_salary ?? 0);
    const allowances = Number(payslip?.total_allowances ?? 0);
    const net = Number(payslip?.net_salary ?? 0);
    const pr = payslip?.payroll_runs;
    const month =
        (typeof pr === 'object' && pr?.run_month) ||
        payslip?.run_month ||
        '—';

    const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 50],
        content: [
            { text: tenant?.name_ar || tenant?.name || 'الشركة', style: 'companyName', alignment: 'right' },
            { text: 'قسيمة راتب', style: 'title', alignment: 'center', margin: [0, 12, 0, 8] },
            {
                text: [
                    { text: 'الموظف: ', bold: true },
                    employee?.full_name || '—',
                    '   ',
                    { text: 'الشهر: ', bold: true },
                    String(month),
                ],
                alignment: 'right',
                margin: [0, 0, 0, 16],
            },
            {
                table: {
                    widths: ['*', 'auto'],
                    body: [
                        [
                            { text: 'البند', style: 'tableHeader', alignment: 'right' },
                            { text: 'AED', style: 'tableHeader', alignment: 'center' },
                        ],
                        [
                            { text: 'الراتب الأساسي', alignment: 'right' },
                            { text: basic.toFixed(2), alignment: 'center' },
                        ],
                        [
                            { text: 'البدلات', alignment: 'right' },
                            { text: allowances.toFixed(2), alignment: 'center' },
                        ],
                        [
                            { text: 'الخصومات', alignment: 'right' },
                            { text: '0.00', alignment: 'center' },
                        ],
                        [
                            { text: 'صافي الراتب', bold: true, alignment: 'right' },
                            { text: net.toFixed(2), bold: true, alignment: 'center' },
                        ],
                    ],
                },
            },
            { text: ' ', margin: [0, 16] },
            {
                text: [{ text: 'IBAN: ', bold: true }, payslip?.iban || '—'],
                alignment: 'right',
            },
            { text: ' ', margin: [0, 40] },
            {
                columns: [
                    { text: 'توقيع الموظف\n________________', alignment: 'center', fontSize: 9 },
                    { text: 'ختم وتوقيع الشركة (placeholder)\n________________', alignment: 'center', fontSize: 9 },
                ],
            },
        ],
        styles: {
            companyName: { fontSize: 18, bold: true, color: '#071C3B' },
            title: { fontSize: 14, bold: true, color: '#00CFFF' },
            tableHeader: { bold: true, fillColor: '#071C3B', color: 'white', margin: [5, 5] },
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 11,
            alignment: 'right',
        },
    };

    pdfMake.createPdf(docDefinition).download(`payslip-${String(month)}.pdf`);
}
