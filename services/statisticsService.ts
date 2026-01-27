import { supabase } from '@/lib/supabase';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { TotalBalanceByCurrency } from '@/types/database';

export interface PeriodStats {
  transactions: number;
  movements: number;
  transactionAmount: number;
  movementAmount: number;
  commissionAmount: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  totalMovements: number;
  balance: number;
  lastActivity: string;
}

export interface CommissionStats {
  totalCommission: number;
  commissionByCurrency: { currency: string; total: number }[];
}

export interface CashFlowByCurrency {
  currency: string;
  totalReceived: number;
  totalPaid: number;
  netFlow: number;
}

export interface DebtStats {
  totalOwedToUs: number;
  totalWeOwe: number;
  owedToUsByCurrency: { currency: string; amount: number }[];
  weOweByCurrency: { currency: string; amount: number }[];
}

export interface StatisticsData {
  totalCustomers: number;
  totalTransactions: number;
  totalMovements: number;
  totalAmount: number;
  totalDebts: number;
  totalWeOwe: number;
  periodStats: {
    today: PeriodStats;
    yesterday: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
  };
  currencyBalances: TotalBalanceByCurrency[];
  cashFlowByCurrency: CashFlowByCurrency[];
  topCustomers: TopCustomer[];
  commissionStats: CommissionStats;
  debtStats: DebtStats;
}

export class StatisticsService {
  static async fetchPeriodStats(startDate: Date, endDate: Date): Promise<PeriodStats> {
    const start = startOfDay(startDate).toISOString();
    const end = endOfDay(endDate).toISOString();

    const [transactionsResult, movementsResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount_sent')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('account_movements')
        .select('amount, commission, commission_currency, is_commission_movement')
        .gte('created_at', start)
        .lte('created_at', end)
        .or('is_commission_movement.is.null,is_commission_movement.eq.false'),
    ]);

    const transactionAmount =
      transactionsResult.data?.reduce((sum, t) => sum + Number(t.amount_sent), 0) || 0;

    const movementAmount =
      movementsResult.data?.reduce((sum, m) => sum + Number(m.amount), 0) || 0;

    const commissionAmount =
      movementsResult.data?.reduce(
        (sum, m) => sum + (m.commission ? Number(m.commission) : 0),
        0
      ) || 0;

    return {
      transactions: transactionsResult.data?.length || 0,
      movements: movementsResult.data?.length || 0,
      transactionAmount,
      movementAmount,
      commissionAmount,
    };
  }

  static async fetchTopCustomers(limit: number = 5): Promise<TopCustomer[]> {
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .order('total_movements', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top customers:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalMovements: customer.total_movements || 0,
      balance: Number(customer.balance) || 0,
      lastActivity: customer.updated_at || customer.created_at,
    }));
  }

  static async fetchCommissionStats(): Promise<CommissionStats> {
    const { data, error } = await supabase
      .from('account_movements')
      .select('commission, commission_currency')
      .not('commission', 'is', null)
      .gt('commission', 0);

    if (error) {
      console.error('Error fetching commission stats:', error);
      return {
        totalCommission: 0,
        commissionByCurrency: [],
      };
    }

    if (!data || data.length === 0) {
      return {
        totalCommission: 0,
        commissionByCurrency: [],
      };
    }

    const totalCommission = data.reduce(
      (sum, m) => sum + (m.commission ? Number(m.commission) : 0),
      0
    );

    const commissionByCurrency = data.reduce(
      (acc, m) => {
        if (!m.commission || !m.commission_currency) return acc;

        const existing = acc.find((item) => item.currency === m.commission_currency);
        if (existing) {
          existing.total += Number(m.commission);
        } else {
          acc.push({
            currency: m.commission_currency,
            total: Number(m.commission),
          });
        }
        return acc;
      },
      [] as { currency: string; total: number }[]
    );

    return {
      totalCommission,
      commissionByCurrency: commissionByCurrency.sort((a, b) => b.total - a.total),
    };
  }

  static async fetchDebtStats(): Promise<DebtStats> {
    const { data: balances, error } = await supabase
      .from('customer_balances_by_currency')
      .select('*');

    if (error) {
      console.error('Error fetching debt stats:', error);
      return {
        totalOwedToUs: 0,
        totalWeOwe: 0,
        owedToUsByCurrency: [],
        weOweByCurrency: [],
      };
    }

    if (!balances || balances.length === 0) {
      return {
        totalOwedToUs: 0,
        totalWeOwe: 0,
        owedToUsByCurrency: [],
        weOweByCurrency: [],
      };
    }

    const owedToUsByCurrency: { [key: string]: number } = {};
    const weOweByCurrency: { [key: string]: number } = {};

    balances.forEach((balance) => {
      const amount = Number(balance.balance);
      const currency = balance.currency;

      if (amount > 0) {
        weOweByCurrency[currency] = (weOweByCurrency[currency] || 0) + amount;
      } else if (amount < 0) {
        owedToUsByCurrency[currency] = (owedToUsByCurrency[currency] || 0) + Math.abs(amount);
      }
    });

    const totalOwedToUs = Object.values(owedToUsByCurrency).reduce(
      (sum, val) => sum + val,
      0
    );
    const totalWeOwe = Object.values(weOweByCurrency).reduce((sum, val) => sum + val, 0);

    return {
      totalOwedToUs,
      totalWeOwe,
      owedToUsByCurrency: Object.entries(owedToUsByCurrency).map(([currency, amount]) => ({
        currency,
        amount,
      })),
      weOweByCurrency: Object.entries(weOweByCurrency).map(([currency, amount]) => ({
        currency,
        amount,
      })),
    };
  }

  static async fetchCashFlowByCurrency(): Promise<CashFlowByCurrency[]> {
    const { data: movements, error } = await supabase
      .from('account_movements')
      .select('amount, currency, movement_type, is_internal_transfer, commission, commission_currency, is_commission_movement')
      .or('is_internal_transfer.is.null,is_internal_transfer.eq.false')
      .or('is_commission_movement.is.null,is_commission_movement.eq.false');

    if (error) {
      console.error('Error fetching cash flow:', error);
      return [];
    }

    if (!movements || movements.length === 0) {
      return [];
    }

    const flowByCurrency: { [key: string]: CashFlowByCurrency } = {};

    movements.forEach((movement) => {
      const currency = movement.currency;
      const amount = Number(movement.amount);

      if (!flowByCurrency[currency]) {
        flowByCurrency[currency] = {
          currency,
          totalReceived: 0,
          totalPaid: 0,
          netFlow: 0,
        };
      }

      if (movement.movement_type === 'incoming') {
        flowByCurrency[currency].totalReceived += amount;
      } else if (movement.movement_type === 'outgoing') {
        flowByCurrency[currency].totalPaid += amount;
      }

      if (
        movement.movement_type === 'outgoing' &&
        movement.commission &&
        Number(movement.commission) > 0 &&
        movement.commission_currency
      ) {
        const commissionCurrency = movement.commission_currency;
        const commissionAmount = Number(movement.commission);

        if (!flowByCurrency[commissionCurrency]) {
          flowByCurrency[commissionCurrency] = {
            currency: commissionCurrency,
            totalReceived: 0,
            totalPaid: 0,
            netFlow: 0,
          };
        }

        flowByCurrency[commissionCurrency].totalPaid += commissionAmount;
      }
    });

    Object.values(flowByCurrency).forEach((flow) => {
      flow.netFlow = flow.totalReceived - flow.totalPaid;
    });

    return Object.values(flowByCurrency);
  }

  static async fetchAllStatistics(): Promise<StatisticsData> {
    try {
      const now = new Date();
      const today = now;
      const yesterday = subDays(now, 1);
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);

      const [
        customersResult,
        allTransactionsResult,
        allMovementsResult,
        currencyBalancesResult,
        todayStats,
        yesterdayStats,
        weekStats,
        monthStats,
        topCustomers,
        commissionStats,
        debtStats,
        cashFlowByCurrency,
      ] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('transactions').select('amount_sent'),
        supabase
          .from('account_movements')
          .select('amount')
          .or('is_commission_movement.is.null,is_commission_movement.eq.false'),
        supabase.from('total_balances_by_currency').select('*'),
        this.fetchPeriodStats(today, today),
        this.fetchPeriodStats(yesterday, yesterday),
        this.fetchPeriodStats(weekAgo, today),
        this.fetchPeriodStats(monthAgo, today),
        this.fetchTopCustomers(5),
        this.fetchCommissionStats(),
        this.fetchDebtStats(),
        this.fetchCashFlowByCurrency(),
      ]);

      if (customersResult.error) {
        console.error('Error fetching customers count:', customersResult.error);
      }
      if (allTransactionsResult.error) {
        console.error('Error fetching transactions:', allTransactionsResult.error);
      }
      if (allMovementsResult.error) {
        console.error('Error fetching movements:', allMovementsResult.error);
      }
      if (currencyBalancesResult.error) {
        console.error('Error fetching currency balances:', currencyBalancesResult.error);
      }

      const totalAmount =
        allMovementsResult.data?.reduce((sum, m) => sum + Number(m.amount), 0) || 0;

      return {
        totalCustomers: customersResult.count || 0,
        totalTransactions: allTransactionsResult.data?.length || 0,
        totalMovements: allMovementsResult.data?.length || 0,
        totalAmount,
        totalDebts: debtStats.totalOwedToUs,
        totalWeOwe: debtStats.totalWeOwe,
        periodStats: {
          today: todayStats,
          yesterday: yesterdayStats,
          week: weekStats,
          month: monthStats,
        },
        currencyBalances: currencyBalancesResult.data || [],
        cashFlowByCurrency,
        topCustomers,
        commissionStats,
        debtStats,
      };
    } catch (error) {
      console.error('Error in fetchAllStatistics:', error);
      throw error;
    }
  }

  static async fetchCustomDateRangeStats(
    startDate: Date,
    endDate: Date
  ): Promise<PeriodStats> {
    return this.fetchPeriodStats(startDate, endDate);
  }
}
