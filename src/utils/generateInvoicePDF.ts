import pdfMake from 'pdfmake/build/pdfmake';

export async function generateInvoicePDF(invoice: any, tenant: any) {
  const total = Number(invoice?.total ?? 0);
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content: [
      {
        columns: [{ text: tenant?.name || 'My Company', style: 'companyName', alignment: 'right' }],
      },
      { text: ' ', margin: [0, 10] },
      { text: 'فاتورة ضريبية', style: 'invoiceTitle', alignment: 'center' },
      {
        columns: [
          {
            text: [{ text: 'رقم الفاتورة: ', bold: true }, invoice.invoice_no || '-'],
            alignment: 'right',
          },
          {
            text: [{ text: 'التاريخ: ', bold: true }, new Date(invoice.created_at).toLocaleDateString('ar-AE')],
            alignment: 'right',
          },
        ],
        margin: [0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'الصنف', style: 'tableHeader', alignment: 'right' },
              { text: 'الكمية', style: 'tableHeader', alignment: 'center' },
              { text: 'السعر', style: 'tableHeader', alignment: 'center' },
              { text: 'الإجمالي', style: 'tableHeader', alignment: 'center' },
            ],
            ...((invoice.invoice_items || []).map((item: any) => [
              { text: item.description || item.name || '-', alignment: 'right' },
              { text: String(item.quantity ?? 1), alignment: 'center' },
              { text: `${Number(item.unit_price ?? 0).toFixed(2)} AED`, alignment: 'center' },
              { text: `${Number(item.total ?? item.line_total ?? 0).toFixed(2)} AED`, alignment: 'center' },
            ]) as any[]),
          ],
        },
        margin: [0, 20],
      },
      {
        columns: [
          { text: '' },
          {
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'المجموع قبل الضريبة:', alignment: 'right' },
                  { text: `${(total / 1.05).toFixed(2)} AED`, alignment: 'right' },
                ],
                [
                  { text: 'ضريبة القيمة المضافة (5%):', alignment: 'right' },
                  { text: `${(total - total / 1.05).toFixed(2)} AED`, alignment: 'right' },
                ],
                [
                  { text: 'الإجمالي:', style: 'totalLabel', alignment: 'right' },
                  { text: `${total.toFixed(2)} AED`, style: 'totalAmount', alignment: 'right' },
                ],
              ],
            },
            layout: 'noBorders',
            width: '50%',
          },
        ],
      },
    ],
    styles: {
      companyName: { fontSize: 20, bold: true, color: '#071C3B' },
      invoiceTitle: { fontSize: 18, bold: true, margin: [0, 10] },
      tableHeader: { bold: true, fillColor: '#071C3B', color: 'white', margin: [5, 5] },
      totalLabel: { bold: true, fontSize: 12 },
      totalAmount: { bold: true, fontSize: 14, color: '#00CFFF' },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      alignment: 'right',
    },
  };

  pdfMake.createPdf(docDefinition).download(`فاتورة-${invoice.invoice_no || invoice.id}.pdf`);
}
