import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export interface AccountStatementTemplateData {
  customerName: string;
  accountNumber: string;
  balance: string;
  shopName?: string;
  shopPhone?: string;
}

export interface TransactionTemplateData {
  customerName: string;
  transactionNumber: string;
  amountSent: string;
  amountReceived: string;
  currencySent: string;
  currencyReceived: string;
  shopName?: string;
  shopPhone?: string;
}

export const DEFAULT_ACCOUNT_STATEMENT_TEMPLATE = `مرحباً {customer_name}،
رقم الحساب: {account_number}
التاريخ: {date}

{balance}`;

export const DEFAULT_TRANSACTION_TEMPLATE = `مرحباً {customer_name}،

سند الحوالة رقم: {transaction_number}

المبلغ المرسل: {amount_sent} {currency_sent}
المبلغ المستلم: {amount_received} {currency_received}

شكراً لثقتكم بنا
{shop_name}`;

export function processAccountStatementTemplate(
  template: string | null | undefined,
  data: AccountStatementTemplateData
): string {
  const currentDate = format(new Date(), 'EEEE، dd MMMM yyyy', {
    locale: ar,
  });

  const templateToUse = template || DEFAULT_ACCOUNT_STATEMENT_TEMPLATE;

  let message = templateToUse;

  message = message.replace(/{customer_name}/g, data.customerName);
  message = message.replace(/{account_number}/g, data.accountNumber);
  message = message.replace(/{date}/g, currentDate);
  message = message.replace(/{balance}/g, data.balance);

  if (data.shopName) {
    message = message.replace(/{shop_name}/g, data.shopName);
  }

  if (data.shopPhone) {
    message = message.replace(/{shop_phone}/g, data.shopPhone);
  }

  return message;
}

export function processTransactionTemplate(
  template: string | null | undefined,
  data: TransactionTemplateData
): string {
  const currentDate = format(new Date(), 'EEEE، dd MMMM yyyy', {
    locale: ar,
  });

  const templateToUse = template || DEFAULT_TRANSACTION_TEMPLATE;

  let message = templateToUse;

  message = message.replace(/{customer_name}/g, data.customerName);
  message = message.replace(/{transaction_number}/g, data.transactionNumber);
  message = message.replace(/{amount_sent}/g, data.amountSent);
  message = message.replace(/{amount_received}/g, data.amountReceived);
  message = message.replace(/{currency_sent}/g, data.currencySent);
  message = message.replace(/{currency_received}/g, data.currencyReceived);
  message = message.replace(/{date}/g, currentDate);

  if (data.shopName) {
    message = message.replace(/{shop_name}/g, data.shopName);
  }

  if (data.shopPhone) {
    message = message.replace(/{shop_phone}/g, data.shopPhone);
  }

  return message;
}

export const AVAILABLE_VARIABLES = {
  accountStatement: [
    { variable: '{customer_name}', description: 'اسم العميل' },
    { variable: '{account_number}', description: 'رقم الحساب' },
    { variable: '{date}', description: 'التاريخ الحالي' },
    { variable: '{balance}', description: 'الرصيد الحالي مع العملة' },
    { variable: '{shop_name}', description: 'اسم المحل' },
    { variable: '{shop_phone}', description: 'رقم هاتف المحل' },
  ],
  transaction: [
    { variable: '{customer_name}', description: 'اسم العميل' },
    { variable: '{transaction_number}', description: 'رقم الحوالة' },
    { variable: '{amount_sent}', description: 'المبلغ المرسل' },
    { variable: '{amount_received}', description: 'المبلغ المستلم' },
    { variable: '{currency_sent}', description: 'عملة الإرسال' },
    { variable: '{currency_received}', description: 'عملة الاستلام' },
    { variable: '{date}', description: 'التاريخ الحالي' },
    { variable: '{shop_name}', description: 'اسم المحل' },
    { variable: '{shop_phone}', description: 'رقم هاتف المحل' },
  ],
};
