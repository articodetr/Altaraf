import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Search,
  ArrowUpDown,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CustomerBalanceByCurrency, CURRENCIES, Currency } from '@/types/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generatePDFHeaderHTML, generatePDFHeaderStyles } from '@/utils/pdfHeaderGenerator';
import { getLogoBase64 } from '@/utils/logoHelper';

type SortType = 'name' | 'balance' | 'currency';
type FilterCurrency = 'all' | Currency;

interface CustomerDebtSummary {
  customerId: string;
  customerName: string;
  balances: CustomerBalanceByCurrency[];
  totalBalanceUSD: number;
}

export default function DebtSummaryScreen() {
  const router = useRouter();
  const [data, setData] = useState<CustomerDebtSummary[]>([]);
  const [filteredData, setFilteredData] = useState<CustomerDebtSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [filterCurrency, setFilterCurrency] = useState<FilterCurrency>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [data, searchQuery, sortBy, filterCurrency]);

  const loadData = async () => {
    try {
      const { data: balances, error } = await supabase
        .from('customer_balances_by_currency')
        .select('*')
        .order('customer_name');

      if (!error && balances) {
        const grouped = new Map<string, CustomerDebtSummary>();

        balances.forEach((balance) => {
          if (!grouped.has(balance.customer_id)) {
            grouped.set(balance.customer_id, {
              customerId: balance.customer_id,
              customerName: balance.customer_name,
              balances: [],
              totalBalanceUSD: 0,
            });
          }

          const customer = grouped.get(balance.customer_id)!;
          customer.balances.push(balance);
          customer.totalBalanceUSD += Number(balance.balance);
        });

        setData(Array.from(grouped.values()));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let result = [...data];

    if (searchQuery.trim()) {
      result = result.filter((item) =>
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterCurrency !== 'all') {
      result = result.filter((item) =>
        item.balances.some((b) => b.currency === filterCurrency)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.customerName.localeCompare(b.customerName, 'ar');
        case 'balance':
          return Math.abs(b.totalBalanceUSD) - Math.abs(a.totalBalanceUSD);
        case 'currency':
          return a.balances[0]?.currency.localeCompare(b.balances[0]?.currency || '') || 0;
        default:
          return 0;
      }
    });

    setFilteredData(result);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCurrencySymbol = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    return currency?.symbol || code;
  };

  const getCurrencyName = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    return currency?.name || code;
  };

  const getTotalStats = () => {
    const owedByCurrency: { [key: string]: number } = {};
    const owingByCurrency: { [key: string]: number } = {};

    filteredData.forEach((customer) => {
      customer.balances.forEach((balance) => {
        const amount = Number(balance.balance);
        const currency = balance.currency;

        if (amount > 0) {
          owedByCurrency[currency] = (owedByCurrency[currency] || 0) + amount;
        } else {
          owingByCurrency[currency] = (owingByCurrency[currency] || 0) + Math.abs(amount);
        }
      });
    });

    return { owedByCurrency, owingByCurrency };
  };

  const generatePDF = async () => {
    try {
      const stats = getTotalStats();

      let logoDataUrl: string | undefined;
      try {
        logoDataUrl = await getLogoBase64();
        console.log('[DebtSummary] Logo loaded successfully for PDF');
      } catch (logoError) {
        console.warn('[DebtSummary] Could not load logo, continuing without it:', logoError);
      }

      const headerHTML = generatePDFHeaderHTML({
        title: 'تقرير - حركة الحسابات',
        logoDataUrl,
        primaryColor: '#382de3',
        darkColor: '#2821b8',
        height: 150,
        showPhones: true,
      });

      const tableRows = filteredData
        .flatMap((customer) =>
          customer.balances.map((balance) => {
            const amount = Number(balance.balance);
            const totalIncoming = Number(balance.total_incoming);
            const totalOutgoing = Number(balance.total_outgoing);

            const owedToMe = amount < 0 ? Math.abs(amount) : 0;
            const owedByMe = amount > 0 ? amount : 0;

            return `
              <tr>
                <td style="padding: 8px; border: 1px solid #000; text-align: right;">${customer.customerName}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${getCurrencyName(balance.currency)}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${owedToMe > 0 ? owedToMe.toFixed(2) : ''}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${owedByMe > 0 ? owedByMe.toFixed(2) : ''}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${owedToMe > 0 ? owedToMe.toFixed(2) : ''}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${owedByMe > 0 ? owedByMe.toFixed(2) : ''}</td>
              </tr>
            `;
          })
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                size: A4 landscape;
                margin: 15mm;
              }
              body {
                font-family: 'Arial', 'Tahoma', sans-serif;
                padding: 20px;
                margin: 0;
                background: white;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 11px;
              }
              th {
                background: #f3f4f6;
                padding: 10px;
                border: 1px solid #000;
                text-align: center;
                font-weight: bold;
                font-size: 12px;
              }
              td {
                padding: 8px;
                border: 1px solid #000;
              }
              .footer {
                text-align: left;
                margin-top: 20px;
                font-size: 10px;
                color: #6B7280;
              }
              ${generatePDFHeaderStyles()}
            </style>
          </head>
          <body>
            ${headerHTML}

            <table>
              <thead>
                <tr>
                  <th rowspan="2">الحساب</th>
                  <th rowspan="2">العملة</th>
                  <th colspan="2">حركة الفترة</th>
                  <th colspan="2">صافي الرصيد</th>
                </tr>
                <tr>
                  <th>له</th>
                  <th>عليه</th>
                  <th>له</th>
                  <th>عليه</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer">
              ${new Date().toLocaleDateString('en-CA')} - 1/1
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('نجح', 'تم إنشاء التقرير بنجاح');
      }
    } catch (error) {
      console.error('[DebtSummary] Error generating PDF:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء التقرير');
    }
  };

  const renderCustomerCard = (customer: CustomerDebtSummary) => {
    return (
      <View key={customer.customerId} style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <Text style={styles.customerName}>{customer.customerName}</Text>
        </View>

        <View style={styles.balancesContainer}>
          {customer.balances.map((balance) => {
            const amount = Number(balance.balance);
            const isPositive = amount > 0;

            return (
              <View key={balance.currency} style={styles.balanceRow}>
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyName}>{getCurrencyName(balance.currency)}</Text>
                  <Text style={styles.currencyCode}>({balance.currency})</Text>
                </View>

                <View style={styles.amountContainer}>
                  {isPositive ? (
                    <TrendingUp size={16} color="#10B981" />
                  ) : (
                    <TrendingDown size={16} color="#EF4444" />
                  )}
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: isPositive ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isPositive ? '+' : ''}
                    {amount.toFixed(2)} {getCurrencySymbol(balance.currency)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.customerFooter}>
          {customer.balances.map((balance) => (
            <View key={`footer-${balance.currency}`} style={styles.currencySection}>
              <Text style={styles.footerCurrency}>{getCurrencyName(balance.currency)}:</Text>
              <View style={styles.currencyFooterRow}>
                <Text style={styles.totalIncomingLabel}>وارد:</Text>
                <Text style={styles.totalIncoming}>
                  {Number(balance.total_incoming).toFixed(2)} {getCurrencySymbol(balance.currency)}
                </Text>
              </View>
              <View style={styles.currencyFooterRow}>
                <Text style={styles.totalOutgoingLabel}>صادر:</Text>
                <Text style={styles.totalOutgoing}>
                  {Number(balance.total_outgoing).toFixed(2)} {getCurrencySymbol(balance.currency)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const stats = getTotalStats();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowRight size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقرير الديون الشامل</Text>
        <TouchableOpacity style={styles.exportButton} onPress={generatePDF}>
          <Download size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScrollView}>
        <View style={styles.statsContainer}>
          {Object.keys(stats.owedByCurrency).length === 0 && Object.keys(stats.owingByCurrency).length === 0 ? (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>لا توجد ديون</Text>
            </View>
          ) : (
            <>
              {Object.entries(stats.owedByCurrency).map(([currency, amount]) => (
                <View key={`owed-${currency}`} style={styles.statCurrencyCard}>
                  <Text style={styles.statCurrencyLabel}>{getCurrencyName(currency)}</Text>
                  <View style={styles.statCurrencyRow}>
                    <TrendingUp size={16} color="#10B981" />
                    <Text style={styles.statCurrencyLabelSmall}>لي</Text>
                    <Text style={[styles.statCurrencyValue, { color: '#10B981' }]}>
                      {amount.toFixed(2)} {getCurrencySymbol(currency)}
                    </Text>
                  </View>
                  {stats.owingByCurrency[currency] && (
                    <View style={styles.statCurrencyRow}>
                      <TrendingDown size={16} color="#EF4444" />
                      <Text style={styles.statCurrencyLabelSmall}>علي</Text>
                      <Text style={[styles.statCurrencyValue, { color: '#EF4444' }]}>
                        {stats.owingByCurrency[currency].toFixed(2)} {getCurrencySymbol(currency)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              {Object.entries(stats.owingByCurrency)
                .filter(([currency]) => !stats.owedByCurrency[currency])
                .map(([currency, amount]) => (
                  <View key={`owing-${currency}`} style={styles.statCurrencyCard}>
                    <Text style={styles.statCurrencyLabel}>{getCurrencyName(currency)}</Text>
                    <View style={styles.statCurrencyRow}>
                      <TrendingDown size={16} color="#EF4444" />
                      <Text style={styles.statCurrencyLabelSmall}>علي</Text>
                      <Text style={[styles.statCurrencyValue, { color: '#EF4444' }]}>
                        {amount.toFixed(2)} {getCurrencySymbol(currency)}
                      </Text>
                    </View>
                  </View>
                ))}
            </>
          )}

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>عدد العملاء</Text>
            <Text style={[styles.statValue, { color: '#4F46E5' }]}>
              {filteredData.length}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن عميل..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color="#4F46E5" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const sortOptions: SortType[] = ['name', 'balance', 'currency'];
            const currentIndex = sortOptions.indexOf(sortBy);
            const nextIndex = (currentIndex + 1) % sortOptions.length;
            setSortBy(sortOptions[nextIndex]);
          }}
        >
          <ArrowUpDown size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersPanelTitle}>تصفية حسب العملة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.currencyFilter,
                filterCurrency === 'all' && styles.currencyFilterActive,
              ]}
              onPress={() => setFilterCurrency('all')}
            >
              <Text
                style={[
                  styles.currencyFilterText,
                  filterCurrency === 'all' && styles.currencyFilterTextActive,
                ]}
              >
                الكل
              </Text>
            </TouchableOpacity>
            {CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.currencyFilter,
                  filterCurrency === currency.code && styles.currencyFilterActive,
                ]}
                onPress={() => setFilterCurrency(currency.code as FilterCurrency)}
              >
                <Text
                  style={[
                    styles.currencyFilterText,
                    filterCurrency === currency.code && styles.currencyFilterTextActive,
                  ]}
                >
                  {currency.symbol} {currency.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>جاري التحميل...</Text>
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>لا توجد نتائج</Text>
          </View>
        ) : (
          <View style={styles.customersList}>
            {filteredData.map((customer) => renderCustomerCard(customer))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  exportButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsScrollView: {
    flexGrow: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minWidth: 120,
  },
  statCurrencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minWidth: 180,
    gap: 8,
  },
  statCurrencyLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  statCurrencyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  statCurrencyLabelSmall: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },
  statCurrencyValue: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'left',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filtersPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'right',
  },
  currencyFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginLeft: 8,
  },
  currencyFilterActive: {
    backgroundColor: '#4F46E5',
  },
  currencyFilterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  currencyFilterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  customersList: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  customerHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  balancesContainer: {
    gap: 8,
  },
  balanceRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyName: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
  },
  currencyCode: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  customerFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  currencySection: {
    gap: 4,
  },
  currencyFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  footerCurrency: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  totalIncomingLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 50,
  },
  totalIncoming: {
    fontSize: 11,
    color: '#10B981',
    textAlign: 'left',
    flex: 1,
  },
  totalOutgoingLabel: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 50,
  },
  totalOutgoing: {
    fontSize: 11,
    color: '#EF4444',
    textAlign: 'left',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
