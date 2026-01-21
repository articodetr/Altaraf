export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  account_number: string;
  balance: number;
  notes?: string;
  is_profit_loss_account?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  transaction_number: string;
  customer_id: string;
  amount_sent: number;
  currency_sent: string;
  amount_received: number;
  currency_received: string;
  exchange_rate: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface Debt {
  id: string;
  customer_id: string;
  amount: number;
  currency: string;
  reason?: string;
  status: 'pending' | 'paid' | 'partial';
  paid_amount: number;
  due_date?: string;
  created_at: string;
  paid_at?: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: 'api' | 'manual';
  created_at: string;
}

export interface Receipt {
  id: string;
  transaction_id: string;
  receipt_number: string;
  pdf_url?: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  shop_name: string;
  shop_logo?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  selected_receipt_logo?: string | null;
  whatsapp_account_statement_template?: string | null;
  whatsapp_share_account_template?: string | null;
  whatsapp_transaction_template?: string | null;
  pin_code: string;
  updated_at: string;
}

export interface AccountMovement {
  id: string;
  movement_number: string;
  customer_id: string;
  movement_type: 'incoming' | 'outgoing';
  amount: number;
  currency: string;
  commission?: number;
  commission_currency?: string;
  commission_recipient_id?: string;
  notes?: string;
  sender_name?: string;
  beneficiary_name?: string;
  transfer_number?: string;
  receipt_number?: string;
  from_customer_id?: string;
  to_customer_id?: string;
  transfer_direction?: 'shop_to_customer' | 'customer_to_shop' | 'customer_to_customer';
  related_transfer_id?: string;
  is_commission_movement?: boolean;
  related_commission_movement_id?: string;
  created_at: string;
}

export interface CustomerAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  total_incoming: number;
  total_outgoing: number;
  balance: number;
  total_movements: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerStatistics {
  id: string;
  name: string;
  phone: string;
  balance: number;
  total_transactions: number;
  total_sent: number;
  total_debt: number;
}

export interface CustomerBalanceByCurrency {
  customer_id: string;
  customer_name: string;
  currency: string;
  total_incoming: number;
  total_outgoing: number;
  balance: number;
}

export interface TotalBalanceByCurrency {
  currency: string;
  total_incoming: number;
  total_outgoing: number;
  balance: number;
}

export type Currency = 'USD' | 'SAR' | 'TRY' | 'EUR' | 'YER' | 'GBP' | 'AED';

export const CURRENCIES: { code: Currency; name: string; symbol: string }[] = [
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'TRY', name: 'ليرة تركية', symbol: '₺' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'YER', name: 'ريال يمني', symbol: '﷼' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export type TransferPartyType = 'shop' | 'customer';

export interface TransferParty {
  type: TransferPartyType;
  customerId?: string;
  customerName?: string;
}

export type CommissionRecipientType = 'from' | 'to' | null;

export interface InternalTransferRequest {
  from: TransferParty;
  to: TransferParty;
  amount: number;
  currency: Currency;
  notes?: string;
  commission?: number;
  commissionCurrency?: Currency;
  commissionRecipient?: CommissionRecipientType;
  commissionRecipientId?: string;
}

export interface InternalTransferResponse {
  from_movement_id?: string;
  to_movement_id?: string;
  success: boolean;
  message: string;
}
