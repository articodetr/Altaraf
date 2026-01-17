import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Customer, CustomerBalanceByCurrency, CURRENCIES } from '@/types/database';
import { useDataRefresh } from '@/contexts/DataRefreshContext';

interface CustomerWithBalances extends Customer {
  balances: CustomerBalanceByCurrency[];
}

export default function CustomersScreen() {
  const router = useRouter();
  const { lastRefreshTime } = useDataRefresh();
  const [customers, setCustomers] = useState<CustomerWithBalances[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithBalances[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      console.log('[Customers] Auto-refreshing due to data change');
      loadCustomers();
    }
  }, [lastRefreshTime]);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      const [customersResult, balancesResult] = await Promise.all([
        supabase
          .from('customers_with_last_activity')
          .select('*')
          .order('is_profit_loss_account', { ascending: false })
          .order('last_activity_date', { ascending: false }),
        supabase.from('customer_balances_by_currency').select('*'),
      ]);

      if (!customersResult.error && customersResult.data) {
        const balancesMap = new Map<string, CustomerBalanceByCurrency[]>();

        if (!balancesResult.error && balancesResult.data) {
          balancesResult.data.forEach((balance) => {
            if (!balancesMap.has(balance.customer_id)) {
              balancesMap.set(balance.customer_id, []);
            }
            balancesMap.get(balance.customer_id)?.push(balance);
          });
        }

        const customersWithBalances: CustomerWithBalances[] = customersResult.data.map((customer) => ({
          ...customer,
          balances: balancesMap.get(customer.id) || [],
        }));

        setCustomers(customersWithBalances);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
    );
    setFilteredCustomers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  const getAvatarColor = (index: number) => {
    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return colors[index % colors.length];
  };

  const getInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    return name.substring(0, 2);
  };

  const getCurrencySymbol = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    return currency?.symbol || code;
  };

  const handleDeleteCustomer = async (customer: CustomerWithBalances) => {
    const hasBalances = customer.balances.length > 0;
    let message = `هل تريد حذف ${customer.name}؟\n\n`;

    if (hasBalances) {
      message += 'تحذير: العميل لديه رصيد!\n';
      customer.balances.forEach((balance) => {
        const balanceAmount = Number(balance.balance);
        const symbol = getCurrencySymbol(balance.currency);
        if (balanceAmount > 0) {
          message += `• له عندنا ${Math.round(balanceAmount)} ${symbol}\n`;
        } else {
          message += `• لنا عنده ${Math.round(Math.abs(balanceAmount))} ${symbol}\n`;
        }
      });
      message += '\n';
    }

    message += 'سيتم حذف جميع بيانات وحركات العميل!\nلا يمكن التراجع عن هذه العملية.';

    Alert.alert('حذف العميل', message, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data, error } = await supabase.rpc('delete_customer_completely', {
              p_customer_id: customer.id,
            });

            if (error) {
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف العميل');
              console.error('Error deleting customer:', error);
              return;
            }

            const result = data as { success: boolean; message: string };

            if (result.success) {
              Alert.alert('تم الحذف', 'تم حذف العميل بنجاح');
              await loadCustomers();
            } else {
              Alert.alert('خطأ', result.message);
            }
          } catch (error) {
            console.error('Error deleting customer:', error);
            Alert.alert('خطأ', 'حدث خطأ غير متوقع');
          }
        },
      },
    ]);
  };

  const handleResetCustomerAccount = async (customer: CustomerWithBalances) => {
    Alert.alert(
      'تصفير الحساب',
      `هل تريد تصفير حساب ${customer.name}؟\n\nسيتم حذف جميع الحركات مع الاحتفاظ ببيانات العميل.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تصفير',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('reset_customer_account', {
                p_customer_id: customer.id,
              });

              if (error) {
                Alert.alert('خطأ', 'حدث خطأ أثناء تصفير الحساب');
                console.error('Error resetting account:', error);
                return;
              }

              const result = data as { success: boolean; message: string };

              if (result.success) {
                Alert.alert('تم التصفير', 'تم تصفير الحساب بنجاح');
                await loadCustomers();
              } else {
                Alert.alert('خطأ', result.message);
              }
            } catch (error) {
              console.error('Error resetting account:', error);
              Alert.alert('خطأ', 'حدث خطأ غير متوقع');
            }
          },
        },
      ]
    );
  };

  const handleCustomerLongPress = (customer: CustomerWithBalances) => {
    if (customer.is_profit_loss_account) {
      Alert.alert('حساب الأرباح والخسائر', 'هذا حساب النظام ولا يمكن حذفه أو تصفيره.');
      return;
    }

    Alert.alert('خيارات العميل', `اختر العملية لـ ${customer.name}:`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'فتح',
        onPress: () => router.push(`/customer-details?id=${customer.id}` as any),
      },
      {
        text: 'تصفير الحساب',
        onPress: () => handleResetCustomerAccount(customer),
      },
      {
        text: 'حذف العميل',
        onPress: () => handleDeleteCustomer(customer),
        style: 'destructive',
      },
    ]);
  };

  const renderCustomer = ({ item, index }: { item: CustomerWithBalances; index: number }) => {
    const hasBalances = item.balances.length > 0;
    const displayBalances = item.balances.slice(0, 2);
    const isProfitLoss = item.is_profit_loss_account;

    return (
      <TouchableOpacity
        style={[
          styles.customerCard,
          isProfitLoss && styles.profitLossCard,
        ]}
        onPress={() => router.push(`/customer-details?id=${item.id}` as any)}
        onLongPress={() => handleCustomerLongPress(item)}
      >
        {isProfitLoss ? (
          <View style={[styles.avatar, styles.profitLossAvatar]}>
            <TrendingUp size={28} color="#FFFFFF" />
          </View>
        ) : (
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(index) }]}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
        )}

        <Text style={[styles.customerName, isProfitLoss && styles.profitLossName]}>
          {item.name}
          {isProfitLoss && ' 💰'}
        </Text>

        <View style={styles.balanceContainer}>
          {!hasBalances ? (
            <Text style={[styles.balanceText, { color: '#9CA3AF' }]}>متساوي</Text>
          ) : (
            <>
              {displayBalances.map((balance, idx) => {
                const balanceAmount = Number(balance.balance);
                return (
                  <Text
                    key={balance.currency}
                    style={[
                      styles.balanceText,
                      { color: balanceAmount > 0 ? '#10B981' : '#EF4444' },
                      idx > 0 && { fontSize: 13 },
                    ]}
                  >
                    {balanceAmount > 0
                      ? `+${Math.round(balanceAmount)}`
                      : `${Math.round(balanceAmount)}`}{' '}
                    {getCurrencySymbol(balance.currency)}
                  </Text>
                );
              })}
              {item.balances.length > 2 && (
                <Text style={[styles.balanceText, { fontSize: 12, color: '#6B7280' }]}>
                  +{item.balances.length - 2} المزيد
                </Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>العملاء</Text>
      </View>

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

      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isLoading ? 'جاري التحميل...' : 'لا يوجد عملاء'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => router.push('/add-customer' as any)}
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  profitLossCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  profitLossAvatar: {
    backgroundColor: '#F59E0B',
  },
  profitLossName: {
    fontWeight: 'bold',
    color: '#92400E',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  customerName: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    textAlign: 'right',
  },
  balanceContainer: {
    alignItems: 'flex-start',
    gap: 2,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '500',
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
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    backgroundColor: '#10B981',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
