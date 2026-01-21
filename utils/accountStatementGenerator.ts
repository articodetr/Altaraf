import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AccountMovement, CURRENCIES } from '@/types/database';
import { generatePDFHeaderHTML, generatePDFHeaderStyles } from './pdfHeaderGenerator';

interface MovementWithBalance extends AccountMovement {
  runningBalance: number;
}

function getCurrencyName(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency?.name || code;
}

export function generateAccountStatementHTML(
  customerName: string,
  movements: AccountMovement[],
  logoDataUrl?: string,
  isProfitLossAccount?: boolean
): string {
  const allMovements = [...movements];

  const filteredMovements = allMovements
    .filter((m) => {
      if (isProfitLossAccount) return true;
      return !(m as any).is_commission_movement;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Combine base movement + related commission (if exists)
  const getCombinedAmount = (movement: AccountMovement): number => {
    const baseAmount = Number(movement.amount);

    const relatedCommissions = allMovements.filter(
      (m) =>
        (m as any).is_commission_movement === true &&
        (m as any).related_commission_movement_id === movement.id &&
        m.customer_id === movement.customer_id &&
        m.movement_type === movement.movement_type &&
        m.currency === movement.currency
    );

    const commissionTotal = relatedCommissions.reduce((sum, m) => sum + Number(m.amount), 0);
    return baseAmount + commissionTotal;
  };

  // Group by currency
  const groupedByCurrency = filteredMovements.reduce((acc, movement) => {
    if (!acc[movement.currency]) acc[movement.currency] = [];
    acc[movement.currency].push(movement);
    return acc;
  }, {} as Record<string, AccountMovement[]>);

  const reportDate = format(new Date(), 'EEEE، dd MMMM yyyy', { locale: ar });

  const headerHTML = generatePDFHeaderHTML({
    title: `كشف حساب العميل: ${customerName}`,
    logoDataUrl,
    primaryColor: '#382de3',
    darkColor: '#2821b8',
    height: 150,
    showPhones: true,
  });

  const currencies = Object.entries(groupedByCurrency);

  const currencySections = currencies
    .map(([curr, currMovements], idx) => {
      const currencyName = getCurrencyName(curr);

      // Build running balance rows
      const movementsWithBalance: MovementWithBalance[] = [];
      let runningBalance = 0;

      currMovements.forEach((movement) => {
        const combinedAmount = getCombinedAmount(movement);

        if (movement.movement_type === 'incoming') runningBalance += combinedAmount;
        else runningBalance -= combinedAmount;

        movementsWithBalance.push({
          ...movement,
          runningBalance,
        });
      });

      const totalOutgoing = currMovements
        .filter((m) => m.movement_type === 'outgoing')
        .reduce((sum, m) => sum + getCombinedAmount(m), 0);

      const totalIncoming = currMovements
        .filter((m) => m.movement_type === 'incoming')
        .reduce((sum, m) => sum + getCombinedAmount(m), 0);

      const finalBalance = totalIncoming - totalOutgoing;

      const finalBalanceDisplay =
        finalBalance > 0
          ? `${Math.round(finalBalance).toLocaleString('en-US')} ${currencyName} (له)`
          : finalBalance < 0
            ? `${Math.round(Math.abs(finalBalance)).toLocaleString('en-US')} ${currencyName} (عليه)`
            : '-';

      const totalIncomingStr = totalIncoming > 0 ? Math.round(totalIncoming).toLocaleString('en-US') : '-';
      const totalOutgoingStr = totalOutgoing > 0 ? Math.round(totalOutgoing).toLocaleString('en-US') : '-';

      const movementRows = movementsWithBalance
        .map((movement) => {
          const balanceDisplay =
            movement.runningBalance > 0
              ? `${Math.round(movement.runningBalance).toLocaleString('en-US')} ${currencyName} (له)`
              : movement.runningBalance < 0
                ? `${Math.round(Math.abs(movement.runningBalance)).toLocaleString('en-US')} ${currencyName} (عليه)`
                : '-';

          const dateStr = format(new Date(movement.created_at), 'dd/MM/yyyy');
          const combinedAmount = getCombinedAmount(movement);

          const incomingAmount =
            movement.movement_type === 'incoming' ? Math.round(combinedAmount).toLocaleString('en-US') : '-';

          const outgoingAmount =
            movement.movement_type === 'outgoing' ? Math.round(combinedAmount).toLocaleString('en-US') : '-';

          return `
            <tr>
              <td class="cell text-center">${dateStr}</td>
              <td class="cell cell-notes">${movement.notes || movement.movement_number}</td>
              <td class="cell text-center">${incomingAmount}</td>
              <td class="cell text-center">${outgoingAmount}</td>
              <td class="cell text-center">${balanceDisplay}</td>
            </tr>
          `;
        })
        .join('');

      // Add a page break AFTER each currency section except the last
      const sectionPageBreakClass = idx < currencies.length - 1 ? 'page-break-after' : '';

      return `
        <div class="currency-section ${sectionPageBreakClass}">
          <div class="section-title">
            <h2>كشف حساب ${customerName} - ${currencyName}</h2>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">التاريخ</th>
                <th style="width: 38%;">البيان</th>
                <th style="width: 15%;">له</th>
                <th style="width: 15%;">عليه</th>
                <th style="width: 20%;">الرصيد</th>
              </tr>
            </thead>

            <tbody>
              ${movementRows}

              <tr class="total-row keep-together">
                <td colspan="2" class="cell text-center">المجموع</td>
                <td class="cell text-center">${totalIncomingStr}</td>
                <td class="cell text-center">${totalOutgoingStr}</td>
                <td class="cell text-center">-</td>
              </tr>

              <tr class="final-row keep-together">
                <td colspan="4" class="cell text-center"><strong>الرصيد النهائي</strong></td>
                <td class="cell text-center"><strong>${finalBalanceDisplay}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>كشف الحساب - ${customerName}</title>

  <style>
    /* هوامش ثابتة لكل صفحة (الأهم) */
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      direction: rtl;
      font-family: 'Arial', 'Tahoma', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* لا تستخدم padding في body حتى لا تتصرف بشكل غير متوقع بين الصفحات */
    body { padding: 0; }

    /* مسافة بسيطة داخل الصفحة بدون تغيير مكان الترويسة */
    .print-container {
      padding: 6mm 0;
    }

    .header-wrapper {
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .currency-section {
      margin-bottom: 12mm;
    }

    .currency-section.page-break-after {
      page-break-after: always;
      break-after: page;
    }

    .section-title {
      border: 2px solid #000;
      padding: 12px 20px;
      text-align: center;
      background: #f9fafb;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .section-title h2 {
      font-size: 20px;
      font-weight: bold;
      margin: 0;
      color: #111827;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      border-top: none;
      background: #fff;

      /* اسمح للجدول أن ينقسم طبيعيًا بين الصفحات */
      page-break-inside: auto;
      break-inside: auto;
    }

    thead {
      /* هذا هو الذي يجعل رأس الأعمدة يتكرر في كل صفحة */
      display: table-header-group;
    }

    th {
      background-color: #e5e7eb;
      font-weight: bold;
      padding: 10px 8px;
      border: 1px solid #000;
      font-size: 14px;
      text-align: center;
      color: #111827;
    }

    td {
      padding: 8px 6px;
      border: 1px solid #000;
      text-align: center;
      font-size: 13px;
      color: #374151;
      vertical-align: middle;
    }

    .cell { min-height: 30px; }

    .cell-notes {
      text-align: right;
      padding-right: 12px;
      word-break: break-word;
    }

    /* منع قدر الإمكان تقسيم الصف داخل صفحتين */
    tr, th, td {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .keep-together {
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-before: avoid;
      break-before: avoid;
    }

    .total-row {
      background-color: #f3f4f6;
      font-weight: bold;
      font-size: 14px;
    }

    .final-row {
      background-color: #dbeafe;
      font-weight: bold;
      font-size: 15px;
      color: #1e40af;
    }

    .footer {
      margin-top: 10mm;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      padding: 10px 0;
      border-top: 1px solid #e5e7eb;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    ${generatePDFHeaderStyles()}

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* تأكيد الهوامش داخل الطباعة أيضًا */
      @page {
        size: A4 portrait;
        margin: 15mm 12mm 15mm 12mm;
        orphans: 3;
        widows: 3;
      }

      .print-container { padding: 6mm 0 !important; }
      thead { display: table-header-group !important; }
    }
  </style>
</head>

<body>
  <div class="print-container">
    <!-- الترويسة: تبقى كما هي في الصفحة الأولى -->
    <div class="header-wrapper">
      ${headerHTML}
    </div>

    ${currencySections}

    <div class="footer">
      <div>تاريخ الطباعة: ${reportDate}</div>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateAccountStatementForAllCurrencies(
  customerName: string,
  movements: AccountMovement[],
  logoDataUrl?: string,
  isProfitLossAccount?: boolean
): string {
  return generateAccountStatementHTML(customerName, movements, logoDataUrl, isProfitLossAccount);
}
