import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ArrowDownCircle, ArrowUpCircle, Calendar, ArrowLeftRight, Search, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AccountMovement } from '@/types/database';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MovementWithCustomer extends AccountMovement {
  customer_name: string;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [movements, setMovements] = useState<MovementWithCustomer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('account_movements')
        .select(
          `
          *,
          customers!customer_id!inner(name)
        `
        )
        .order('created_at', { ascending: false });

      if (!error && data) {
        const movementsWithCustomers = data.map((m: any) => ({
          ...m,
          customer_name: m.customers?.name || 'غير معروف',
        }));
        setMovements(movementsWithCustomers);
      }
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMovements();
    setRefreshing(false);
  };

  const filteredMovements = movements.filter((movement) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const movementNumber = movement.movement_number.toLowerCase();
    const notes = (movement.notes || '').toLowerCase();
    const amount = movement.amount.toString();
    const customerName = movement.customer_name.toLowerCase();
    const date = format(new Date(movement.created_at), 'dd/MM/yyyy');
    const movementTypeText = movement.movement_type === 'outgoing' ? 'عليه' : 'له';
    const senderName = (movement.sender_name || '').toLowerCase();
    const beneficiaryName = (movement.beneficiary_name || '').toLowerCase();

    return (
      movementNumber.includes(query) ||
      notes.includes(query) ||
      amount.includes(query) ||
      customerName.includes(query) ||
      date.includes(query) ||
      movementTypeText.includes(query) ||
      senderName.includes(query) ||
      beneficiaryName.includes(query)
    );
  });

  const renderMovement = ({ item }: { item: MovementWithCustomer }) => (
    <TouchableOpacity
      style={styles.movementCard}
      onPress={() => router.push(`/customer-details?id=${item.customer_id}` as any)}
    >
      <View style={styles.movementHeader}>
        <View style={styles.movementInfo}>
          <Text style={styles.movementNumber}>#{item.movement_number}</Text>
          <Text style={styles.customerName}>{item.customer_name}</Text>
        </View>
        <View
          style={[
            styles.movementIcon,
            {
              backgroundColor: item.transfer_direction
                ? '#FEF3C7'
                : item.movement_type === 'incoming' ? '#ECFDF5' : '#FEE2E2',
            },
          ]}
        >
          {item.transfer_direction ? (
            <ArrowLeftRight size={24} color="#F59E0B" />
          ) : item.movement_type === 'incoming' ? (
            <ArrowUpCircle size={24} color="#10B981" />
          ) : (
            <ArrowDownCircle size={24} color="#EF4444" />
          )}
        </View>
      </View>

      <View style={styles.movementBody}>
        <View style={styles.amountRow}>
          <Text
            style={[
              styles.amountValue,
              {
                color: item.transfer_direction
                  ? '#F59E0B'
                  : item.movement_type === 'incoming' ? '#10B981' : '#EF4444',
              },
            ]}
          >
            {item.transfer_direction
              ? ''
              : item.movement_type === 'incoming' ? '+' : '-'}
            {Number(item.amount).toFixed(2)} {item.currency}
          </Text>
        </View>
        <Text style={styles.movementType}>
          {item.transfer_direction
            ? 'تحويل داخلي'
            : item.movement_type === 'incoming' ? 'له (وارد)' : 'عليه (صادر)'}
        </Text>
        {item.transfer_direction && (
          <Text style={styles.movementNotes} numberOfLines={1}>
            {item.transfer_direction === 'customer_to_customer'
              ? `من: ${item.sender_name || 'عميل'} → إلى: ${item.beneficiary_name || 'عميل'}`
              : item.transfer_direction === 'shop_to_customer'
              ? 'من المحل'
              : 'إلى المحل'}
          </Text>
        )}
        {!item.transfer_direction && item.notes && (
          <Text style={styles.movementNotes} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>

      <View style={styles.movementFooter}>
        <Calendar size={14} color="#9CA3AF" />
        <Text style={styles.dateText}>
          {format(new Date(item.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الحركات المالية</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/new-movement' as any)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث في الحركات (عميل، رقم، مبلغ، تاريخ...)"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {searchQuery !== '' && (
          <Text style={styles.searchResultText}>
            {filteredMovements.length} نتيجة
          </Text>
        )}
      </View>

      <FlatList
        data={filteredMovements}
        renderItem={renderMovement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isLoading ? 'جاري التحميل...' : 'لا توجد حركات مالية'}
            </Text>
          </View>
        }
      />
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  movementCard: {
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
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  movementInfo: {
    flex: 1,
  },
  movementNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginBottom: 4,
    textAlign: 'right',
  },
  customerName: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
  },
  movementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementBody: {
    marginBottom: 12,
  },
  amountRow: {
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  movementType: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'right',
    marginBottom: 4,
  },
  movementNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    fontStyle: 'italic',
  },
  movementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
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
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
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
  clearButton: {
    padding: 4,
  },
  searchResultText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'right',
  },
});
