import { COMPANY_INFO } from '@/constants/companyInfo';

export interface PDFHeaderOptions {
  title: string;
  logoDataUrl?: string;
  primaryColor?: string;
  darkColor?: string;
  height?: number;
  showPhones?: boolean;
}

export function generatePDFHeaderHTML(options: PDFHeaderOptions): string {
  const {
    title,
    logoDataUrl,
    primaryColor = '#382de3',
    darkColor = '#2821b8',
    height = 150,
    showPhones = true,
  } = options;

  const logoHTML = logoDataUrl && logoDataUrl !== '' && !logoDataUrl.includes('undefined')
    ? `<img src="${logoDataUrl}" alt="Logo" class="company-logo" onerror="this.style.display='none'" />`
    : `<div class="company-name-ar">الترف</div>
       <div class="company-name-ar">للحوالات المالية</div>`;

  return `
    <div class="pdf-header" style="background: linear-gradient(135deg, ${primaryColor} 0%, ${darkColor} 100%);">
      ${showPhones ? `
      <div class="header-right">
        <div class="contact-box">
          <div class="contact-box-title">Yemen - Sana'a</div>
          <div class="contact-box-phone">${COMPANY_INFO.phone1}</div>
          <div class="contact-box-phone">${COMPANY_INFO.phone2}</div>
        </div>
      </div>
      ` : '<div class="header-spacer"></div>'}

      <div class="header-center">
        ${logoHTML}
        <div class="company-name-en" style="background: #ffffff; color: ${primaryColor};">Al-Taraf Exchange</div>
      </div>

      ${showPhones ? `
      <div class="header-left">
        <div class="contact-box">
          <div class="contact-box-title">اليمن - صنعاء</div>
          <div class="contact-box-phone">${COMPANY_INFO.phone1}</div>
          <div class="contact-box-phone">${COMPANY_INFO.phone2}</div>
        </div>
      </div>
      ` : '<div class="header-spacer"></div>'}
    </div>

    <div class="document-title">${title}</div>
  `;
}

export function generatePDFHeaderStyles(): string {
  return `
    .pdf-header {
      position: relative;
      width: 100%;
      min-height: 140px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 30px;
      margin-bottom: 20px;
      overflow: visible;
      flex-shrink: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .header-left,
    .header-right {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      width: 180px;
      flex-shrink: 0;
    }

    .header-left {
      justify-content: flex-start;
    }

    .header-right {
      justify-content: flex-end;
    }

    .header-center {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }

    .header-spacer {
      width: 180px;
      flex-shrink: 0;
    }

    .contact-box {
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 16px;
      padding: 10px 16px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 170px;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .contact-box-title {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      line-height: 1.4;
      white-space: nowrap;
    }

    .contact-box-phone {
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      direction: ltr;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .company-logo {
      height: 60px;
      width: auto;
      max-width: 180px;
      object-fit: contain;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .company-name-ar {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.3;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      text-align: center;
      white-space: nowrap;
    }

    .company-name-en {
      padding: 6px 20px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      white-space: nowrap;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .document-title {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      color: #111827;
      margin: 18px 0 25px;
      padding: 8px;
    }

    .header-wrapper {
      position: relative;
      display: block;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      .pdf-header {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        page-break-inside: avoid;
        page-break-after: avoid;
        box-sizing: border-box;
      }

      .header-wrapper {
        page-break-inside: avoid;
        page-break-after: avoid;
      }

      .contact-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box;
      }

      .company-name-en {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .company-logo {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
}
