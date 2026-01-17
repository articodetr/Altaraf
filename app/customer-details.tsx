import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { ArrowRight, Phone, MessageCircle, Settings, Plus, Receipt, ChartBar as BarChart3, Calculator, FileText, ChevronDown, ChevronUp, Search, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Customer, AccountMovement, CURRENCIES } from '@/types/database';
import { format, isSameMonth, isSameYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateAccountStatementHTML } from '@/utils/accountStatementGenerator';
import { getLogoBase64 } from '@/utils/logoHelper';
import QuickAddMovementSheet from '@/components/QuickAddMovementSheet';

interface GroupedMovements {
  [key: string]: AccountMovement[];
}

interface CurrencyBalance {
  currency: string;
  incoming: number;
  outgoing: number;
  balance: number;
}

function groupMovementsByMonth(movements: AccountMovement[]): GroupedMovements {
  const grouped: GroupedMovements = {};

  movements.forEach((movement) => {
    const date = new Date(movement.created_at);
    const key = format(date, 'MMMM yyyy', { locale: ar });

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(movement);
  });

  return grouped;
}

function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency?.symbol || code;
}

function getCurrencyName(code: string): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  return currency?.name || code;
}

interface CurrencyTotals {
  currency: string;
  incoming: number;
  outgoing: number;
}

function calculateCurrencyTotals(
  movements: AccountMovement[],
): CurrencyTotals[] {
  const currencyMap: { [key: string]: CurrencyTotals } = {};

  movements.forEach((movement) => {
    const currency = movement.currency;
    if (!currencyMap[currency]) {
      currencyMap[currency] = {
        currency,
        incoming: 0,
        outgoing: 0,
      };
    }

    const amount = Number(movement.amount);
    if (movement.movement_type === 'incoming') {
      currencyMap[currency].incoming += amount;
    } else {
      currencyMap[currency].outgoing += amount;
    }
  });

  return Object.values(currencyMap);
}

function calculateBalanceByCurrency(
  movements: AccountMovement[],
): CurrencyBalance[] {
  const currencyMap: { [key: string]: CurrencyBalance } = {};

  movements.forEach((movement) => {
    const currency = movement.currency;
    if (!currencyMap[currency]) {
      currencyMap[currency] = {
        currency,
        incoming: 0,
        outgoing: 0,
        balance: 0,
      };
    }

    const amount = Number(movement.amount);

    if (movement.movement_type === 'incoming') {
      currencyMap[currency].incoming += amount;
    } else {
      currencyMap[currency].outgoing += amount;
    }
  });

  Object.values(currencyMap).forEach((item) => {
    item.balance = item.incoming - item.outgoing;
  });

  return Object.values(currencyMap).filter((item) => item.balance !== 0);
}

function getCombinedAmount(
  movement: AccountMovement,
  allMovements: AccountMovement[],
): number {
  const baseAmount = Number(movement.amount);

  const relatedCommissions = allMovements.filter(
    (m) =>
      (m as any).is_commission_movement === true &&
      (m as any).related_commission_movement_id === movement.id &&
      m.customer_id === movement.customer_id &&
      m.movement_type === movement.movement_type &&
      m.currency === movement.currency
  );

  const commissionTotal = relatedCommissions.reduce(
    (sum, m) => sum + Number(m.amount),
    0,
  );

  return baseAmount + commissionTotal;
}

function getRelatedCommission(
  movement: AccountMovement,
  allMovements: AccountMovement[],
): number {
  const relatedCommissions = allMovements.filter(
    (m) =>
      (m as any).is_commission_movement === true &&
      (m as any).related_commission_movement_id === movement.id &&
      m.customer_id === movement.customer_id &&
      m.movement_type === movement.movement_type &&
      m.currency === movement.currency
  );

  return relatedCommissions.reduce((sum, m) => sum + Number(m.amount), 0);
}

export default function CustomerDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { lastRefreshTime } = useDataRefresh();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [totalIncoming, setTotalIncoming] = useState(0);
  const [totalOutgoing, setTotalOutgoing] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showCurrencyDetails, setShowCurrencyDetails] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomerData = useCallback(async () => {
    try {
      const [customerResult, movementsResult] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('account_movements')
          .select('*, is_internal_transfer, transfer_group_id, is_commission_movement, related_commission_movement_id')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (customerResult.error || !customerResult.data) {
        Alert.alert('خطأ', 'لم يتم العثور على العميل');
        router.back();
        return;
      }

      setCustomer(customerResult.data);
      setMovements(movementsResult.data || []);

      const incoming =
        movementsResult.data
          ?.filter((m) => m.movement_type === 'incoming')
          .reduce((sum, m) => sum + Number(m.amount), 0) || 0;

      const outgoing =
        movementsResult.data
          ?.filter((m) => m.movement_type === 'outgoing')
          .reduce((sum, m) => sum + Number(m.amount), 0) || 0;

      setTotalIncoming(incoming);
      setTotalOutgoing(outgoing);
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setIsLoading(true);
        loadCustomerData();
      }
    }, [id, loadCustomerData]),
  );

  useEffect(() => {
    if (id && !isLoading) {
      console.log('[CustomerDetails] Auto-refreshing due to data change');
      loadCustomerData();
    }
  }, [lastRefreshTime]);

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
      const balances = calculateBalanceByCurrency(movements);
      const currentDate = format(new Date(), 'EEEE، dd MMMM yyyy', {
        locale: ar,
      });

      let message = `مرحباً ${customer.name}،\n`;
      message += `رقم الحساب: ${customer.account_number}\n`;
      message += `التاريخ: ${currentDate}\n\n`;

      if (balances.length === 0) {
        message += `رصيدك الحالي: متساوي`;
      } else {
        message += `رصيدك الحالي:\n`;
        balances.forEach((currBalance) => {
          const symbol = getCurrencySymbol(currBalance.currency);
          if (currBalance.balance > 0) {
            message += `• لك عندنا ${Math.round(currBalance.balance)} ${symbol}\n`;
          } else {
            message += `• لنا عندك ${Math.round(Math.abs(currBalance.balance))} ${symbol}\n`;
          }
        });
      }

      message += `\nشكراً`;

      const encodedMessage = encodeURIComponent(message);
      Linking.openURL(
        `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`,
      );
    } else {
      Alert.alert('تنبيه', 'لا يوجد رقم هاتف مسجل لهذا العميل');
    }
  };

  const handlePrint = async () => {
    if (!customer) {
      return;
    }

    if (filteredMovements.length === 0) {
      Alert.alert('تنبيه', 'لا توجد حركات لطباعتها');
      return;
    }

    setIsPrinting(true);

    try {
      let logoDataUrl: string | undefined;
      try {
        console.log('[CustomerDetails] Loading logo for PDF...');
        logoDataUrl = await getLogoBase64();

        if (logoDataUrl && logoDataUrl.length > 0) {
          console.log('[CustomerDetails] Logo loaded successfully. Length:', logoDataUrl.length);
        } else {
          console.warn('[CustomerDetails] Logo is empty, will use fallback');
          logoDataUrl = undefined;
        }
      } catch (logoError) {
        console.warn(
          '[CustomerDetails] Could not load logo, continuing without it:',
          logoError,
        );
        logoDataUrl = undefined;
      }

      console.log('[CustomerDetails] Generating HTML for PDF...');
      const html = generateAccountStatementHTML(
        customer.name,
        movements,
        logoDataUrl,
        customer.is_profit_loss_account,
      );

      console.log('[CustomerDetails] Creating PDF file...');
      const { uri } = await Print.printToFileAsync({ html });
      console.log('[CustomerDetails] PDF created at:', uri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `كشف حساب ${customer.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('نجح', 'تم إنشاء كشف الحساب بنجاح');
      }
    } catch (error) {
      console.error('[CustomerDetails] Error generating PDF:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء كشف الحساب');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSettleUp = () => {
    Alert.alert('تسوية الحساب', 'ميزة تسوية الحساب قيد التطوير');
  };

  const handleResetAccount = () => {
    if (!customer) return;

    Alert.alert(
      'تصفير الحساب',
      `هل أنت متأكد من تصفير حساب ${customer.name}?\n\nسيتم حذف جميع الحركات (${movements.length} حركة) مع الاحتفاظ ببيانات العميل.\n\nلا يمكن التراجع عن هذه العملية!`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تصفير',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc(
                'reset_customer_account',
                {
                  p_customer_id: id,
                },
              );

              if (error) {
                Alert.alert('خطأ', 'حدث خطأ أثناء تصفير الحساب');
                console.error('Error resetting account:', error);
                return;
              }

              const result = data as {
                success: boolean;
                message: string;
                movements_deleted: number;
              };

              if (result.success) {
                Alert.alert(
                  'نجح',
                  `تم تصفير الحساب بنجاح\nتم حذف ${result.movements_deleted} حركة`,
                  [
                    {
                      text: 'حسناً',
                      onPress: () => {
                        loadCustomerData();
                      },
                    },
                  ],
                );
              } else {
                Alert.alert('خطأ', result.message);
              }
            } catch (error) {
              console.error('Error resetting account:', error);
              Alert.alert('خطأ', 'حدث خطأ غير متوقع');
            }
          },
        },
      ],
    );
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;

    const balances = calculateBalanceByCurrency(movements);
    const hasBalance =
      balances.length > 0 && balances.some((b) => b.balance !== 0);

    let warningMessage = `هل أنت متأكد من حذف ${customer.name} نهائياً؟\n\n`;

    if (hasBalance) {
      warningMessage += 'تحذير: العميل لديه رصيد غير صفري!\n';
      balances.forEach((currBalance) => {
        const symbol = getCurrencySymbol(currBalance.currency);
        if (currBalance.balance > 0) {
          warningMessage += `• له عندنا ${Math.round(currBalance.balance)} ${symbol}\n`;
        } else {
          warningMessage += `• لنا عنده ${Math.round(Math.abs(currBalance.balance))} ${symbol}\n`;
        }
      });
      warningMessage += '\n';
    }

    warningMessage += `سيتم حذف:\n`;
    warningMessage += `• جميع بيانات العميل\n`;
    warningMessage += `• جميع الحركات (${movements.length} حركة)\n\n`;
    warningMessage += `لا يمكن التراجع عن هذه العملية!`;

    Alert.alert('حذف العميل', warningMessage, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          Alert.alert('تأكيد نهائي', 'هل أنت متأكد تماماً من حذف هذا العميل؟', [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'نعم، احذف',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { data, error } = await supabase.rpc(
                    'delete_customer_completely',
                    {
                      p_customer_id: id,
                    },
                  );

                  if (error) {
                    Alert.alert('خطأ', 'حدث خطأ أثناء حذف العميل');
                    console.error('Error deleting customer:', error);
                    return;
                  }

                  const result = data as {
                    success: boolean;
                    message: string;
                    movements_deleted: number;
                  };

                  if (result.success) {
                    Alert.alert(
                      'تم الحذف',
                      `تم حذف العميل بنجاح\nتم حذف ${result.movements_deleted} حركة`,
                      [
                        {
                          text: 'حسناً',
                          onPress: () => router.back(),
                        },
                      ],
                    );
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
        },
      },
    ]);
  };

  const handleShareAccount = async () => {
    if (!customer) return;

    const balances = calculateBalanceByCurrency(movements);
    let accountText = `تقرير حساب العميل: ${customer.name}\n`;
    accountText += `=====================================\n\n`;

    if (balances.length === 0) {
      accountText += `الحالة: الحساب متساوي\n\n`;
    } else {
      accountText += `الأرصدة:\n`;
      balances.forEach((currBalance) => {
        const symbol = getCurrencySymbol(currBalance.currency);
        if (currBalance.balance > 0) {
          accountText += `• للعميل عندنا: ${Math.round(currBalance.balance)} ${symbol}\n`;
        } else {
          accountText += `• لنا عند العميل: ${Math.round(Math.abs(currBalance.balance))} ${symbol}\n`;
        }
      });
      accountText += `\n`;
    }

    if (movements.length > 0) {
      accountText += `تفاصيل الحركات:\n`;
      accountText += `=====================================\n\n`;

      const grouped = groupMovementsByMonth(movements);
      Object.entries(grouped).forEach(([monthYear, monthMovements]) => {
        accountText += `${monthYear}\n`;
        accountText += `-------------------------------------\n`;
        monthMovements.forEach((movement) => {
          const date = format(new Date(movement.created_at), 'dd/MM/yyyy', {
            locale: ar,
          });
          const type =
            movement.movement_type === 'outgoing'
              ? 'عليه'
              : 'له';
          const symbol = getCurrencySymbol(movement.currency);
          accountText += `${date} - ${type} ${movement.movement_number}\n`;
          accountText += `المبلغ: ${Math.round(Number(movement.amount))} ${symbol}\n`;
          if (movement.notes) {
            accountText += `الملاحظات: ${movement.notes}\n`;
          }
          accountText += `\n`;
        });
        accountText += `\n`;
      });
    }

    accountText += `\nتم إنشاء التقرير بتاريخ: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}\n`;

    try {
      await Linking.openURL(
        `whatsapp://send?text=${encodeURIComponent(accountText)}`,
      );
    } catch (error) {
      Alert.alert('مشاركة الحساب', accountText, [
        { text: 'إغلاق', style: 'cancel' },
      ]);
    }
  };

  const handleAddMovement = () => {
    console.log('[CustomerDetails] handleAddMovement called');
    setShowQuickAdd(true);
    console.log('[CustomerDetails] setShowQuickAdd(true) called');
  };

  const handleMovementPress = (movement: AccountMovement) => {
    const movementTypeText =
      movement.movement_type === 'outgoing' ? 'عليه' : 'له';
    const currencySymbol = getCurrencySymbol(movement.currency);
    const amount = Math.round(Number(movement.amount));

    Alert.alert(
      `${movementTypeText} - ${movement.movement_number}`,
      `${amount} ${currencySymbol}`,
      [
        {
          text: 'طباعة السند',
          onPress: () => handlePrintMovementReceipt(movement),
        },
        {
          text: 'تعديل',
          onPress: () => handleEditMovement(movement),
        },
        {
          text: 'حذف',
          onPress: () => handleDeleteMovement(movement),
          style: 'destructive',
        },
        {
          text: 'إلغاء',
          style: 'cancel',
        },
      ],
    );
  };

  const handleEditMovement = (movement: AccountMovement) => {
    router.push({
      pathname: '/edit-movement',
      params: {
        movementId: movement.id,
        customerName: customer?.name,
        customerAccountNumber: customer?.account_number,
      },
    });
  };

  const handleDeleteMovement = (movement: AccountMovement) => {
    const movementTypeText =
      movement.movement_type === 'outgoing' ? 'عليه' : 'له';
    const currencySymbol = getCurrencySymbol(movement.currency);
    const amount = Math.round(Number(movement.amount));

    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف هذه الحركة؟\n\n${movementTypeText} - ${movement.movement_number}\nالمبلغ: ${amount} ${currencySymbol}\n\nلا يمكن التراجع.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => confirmDeleteMovement(movement),
        },
      ],
    );
  };

  const confirmDeleteMovement = async (movement: AccountMovement) => {
    try {
      const { error } = await supabase
        .from('account_movements')
        .delete()
        .eq('id', movement.id);

      if (error) throw error;

      Alert.alert('نجح', 'تم حذف الحركة بنجاح');
      loadCustomerData();
    } catch (error) {
      console.error('Error deleting movement:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حذف الحركة');
    }
  };

  const handlePrintMovementReceipt = (movement: AccountMovement) => {
    router.push({
      pathname: '/receipt-preview',
      params: {
        movementId: movement.id,
        customerName: customer?.name,
        customerAccountNumber: customer?.account_number,
      },
    });
  };

  const balance = customer?.balance || 0;

  const filteredMovements = movements
    .filter((movement) => {
      if (customer?.is_profit_loss_account) {
        return true;
      }
      return (movement as any).is_commission_movement !== true;
    })
    .filter((movement) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const movementNumber = movement.movement_number.toLowerCase();
      const notes = (movement.notes || '').toLowerCase();
      const amount = movement.amount.toString();
      const date = format(new Date(movement.created_at), 'dd/MM/yyyy');
      const movementTypeText =
        movement.movement_type === 'outgoing' ? 'عليه' : 'له';
      const senderName = (movement.sender_name || '').toLowerCase();
      const beneficiaryName = (movement.beneficiary_name || '').toLowerCase();

      return (
        movementNumber.includes(query) ||
        notes.includes(query) ||
        amount.includes(query) ||
        date.includes(query) ||
        movementTypeText.includes(query) ||
        senderName.includes(query) ||
        beneficiaryName.includes(query)
      );
    });

  const groupedMovements = groupMovementsByMonth(filteredMovements);
  const currencyBalances = calculateBalanceByCurrency(filteredMovements);
  const currencyTotals = calculateCurrencyTotals(filteredMovements);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#059669', '#10B981', '#34D399']}
          style={styles.gradientHeader}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowRight size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>تفاصيل العميل</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  if (!customer) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        style={styles.gradientHeader}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowRight size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{customer.name}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettingsMenu(true)}
          >
            <Settings size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.headerBadge}>
            <Receipt size={14} color="#FFFFFF" />
            <Text style={styles.headerBadgeText}>{movements.length} حركة</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              رقم الحساب: {customer.account_number}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.summarySection}>
          {currencyBalances.length === 0 ? (
            <Text style={styles.summaryMainText}>الحساب متساوي</Text>
          ) : (
            currencyBalances.map((currBalance) => (
              <View
                key={currBalance.currency}
                style={styles.currencyBalanceContainer}
              >
                {currBalance.balance > 0 ? (
                  <Text style={styles.summaryLineGreen}>
                    {customer.name} له عندنا{' '}
                    <Text style={styles.summaryAmountGreen}>
                      {Math.round(currBalance.balance)}{' '}
                      {getCurrencySymbol(currBalance.currency)}
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.summaryLineRed}>
                    لنا عند {customer.name}{' '}
                    <Text style={styles.summaryAmountRed}>
                      {Math.round(Math.abs(currBalance.balance))}{' '}
                      {getCurrencySymbol(currBalance.currency)}
                    </Text>
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {currencyTotals.length > 0 && (
          <View style={styles.currencyDetailsSection}>
            <TouchableOpacity
              style={styles.currencyDetailsToggle}
              onPress={() => setShowCurrencyDetails(!showCurrencyDetails)}
            >
              <View style={styles.currencyDetailsToggleContent}>
                {showCurrencyDetails ? (
                  <ChevronUp size={20} color="#6B7280" />
                ) : (
                  <ChevronDown size={20} color="#6B7280" />
                )}
                <Text style={styles.currencyDetailsToggleText}>
                  ملخص الحركات
                </Text>
              </View>
            </TouchableOpacity>

            {showCurrencyDetails && (
              <View style={styles.currencyDetailsContent}>
                {currencyTotals.map((total) => (
                  <View key={total.currency} style={styles.currencyDetailsCard}>
                    <Text style={styles.currencyDetailsName}>
                      {getCurrencyName(total.currency)}:
                    </Text>
                    <View style={styles.currencyDetailsRow}>
                      <Text style={styles.currencyDetailsValueGreen}>
                        {total.incoming.toFixed(2)}{' '}
                        {getCurrencySymbol(total.currency)}
                      </Text>
                      <Text style={styles.currencyDetailsLabelGreen}>
                        وارد:
                      </Text>
                    </View>
                    <View style={styles.currencyDetailsRow}>
                      <Text style={styles.currencyDetailsValueRed}>
                        {total.outgoing.toFixed(2)}{' '}
                        {getCurrencySymbol(total.currency)}
                      </Text>
                      <Text style={styles.currencyDetailsLabelRed}>صادر:</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.tabButtons}>
          <TouchableOpacity
            style={styles.tabButtonPrimary}
            onPress={handleShareAccount}
          >
            <Text style={styles.tabButtonPrimaryText}>مشاركة الحساب</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, isPrinting && styles.tabButtonDisabled]}
            onPress={handlePrint}
            disabled={isPrinting || movements.length === 0}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <FileText size={16} color="#6B7280" />
            )}
            <Text style={styles.tabButtonText}>طباعة PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={handleCall}>
            <Phone size={16} color="#6B7280" />
            <Text style={styles.tabButtonText}>اتصال</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={handleWhatsApp}>
            <MessageCircle size={16} color="#6B7280" />
            <Text style={styles.tabButtonText}>واتساب</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث في الحركات (رقم، مبلغ، تاريخ، ملاحظات...)"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
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

        <View style={styles.movementsSection}>
          {filteredMovements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد حركات</Text>
            </View>
          ) : (
            Object.entries(groupedMovements).map(
              ([monthYear, monthMovements]) => (
                <View key={monthYear}>
                  <Text style={styles.monthHeader}>{monthYear}</Text>
                  {monthMovements.map((movement) => (
                    <TouchableOpacity
                      key={movement.id}
                      style={styles.movementRow}
                      activeOpacity={0.7}
                      onPress={() => handleMovementPress(movement)}
                    >
                      <View style={styles.movementDate}>
                        <Text style={styles.movementDateMonth}>
                          {format(new Date(movement.created_at), 'MMM', {
                            locale: ar,
                          })}
                        </Text>
                        <Text style={styles.movementDateDay}>
                          {format(new Date(movement.created_at), 'dd')}
                        </Text>
                      </View>

                      <View style={styles.movementNumberContainer}>
                        <Text style={styles.movementNumber}>
                          {movement.movement_number}
                        </Text>
                      </View>

                      <View style={styles.movementTypeContainer}>
                        <Text
                          style={[
                            styles.movementType,
                            {
                              color: (movement as any).is_internal_transfer
                                ? '#F59E0B'
                                : movement.movement_type === 'outgoing'
                                  ? '#EF4444'
                                  : '#10B981',
                            },
                          ]}
                        >
                          {(movement as any).is_internal_transfer
                            ? 'تحويل داخلي'
                            : movement.movement_type === 'outgoing'
                              ? 'عليه'
                              : 'له'}
                        </Text>
                        {(movement as any).is_internal_transfer && (
                          <Text style={styles.movementNotes} numberOfLines={1}>
                            {movement.movement_type === 'outgoing'
                              ? `إلى: ${movement.beneficiary_name || 'عميل آخر'}`
                              : `من: ${movement.sender_name || 'عميل آخر'}`}
                          </Text>
                        )}
                        {!(movement as any).is_internal_transfer &&
                          movement.notes && (
                            <Text
                              style={styles.movementNotes}
                              numberOfLines={1}
                            >
                              {movement.notes}
                            </Text>
                          )}
                      </View>

                      <View style={styles.spacer} />

                      <View
                        style={[
                          styles.movementIcon,
                          {
                            backgroundColor: (movement as any)
                              .is_internal_transfer
                              ? '#FEF3C7'
                              : movement.movement_type === 'outgoing'
                                ? '#FEE2E2'
                                : '#ECFDF5',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.currencySymbolText,
                            {
                              color: (movement as any).is_internal_transfer
                                ? '#F59E0B'
                                : movement.movement_type === 'outgoing'
                                  ? '#EF4444'
                                  : '#10B981',
                            },
                          ]}
                        >
                          {getCurrencySymbol(movement.currency)}
                        </Text>
                      </View>

                      <View style={styles.movementAmount}>
                        <Text
                          style={[
                            styles.movementAmountText,
                            {
                              color: (movement as any).is_internal_transfer
                                ? '#F59E0B'
                                : movement.movement_type === 'outgoing'
                                  ? '#EF4444'
                                  : '#10B981',
                            },
                          ]}
                        >
                          {Math.round(getCombinedAmount(movement, movements))}
                        </Text>
                        {getRelatedCommission(movement, movements) > 0 && (
                          <Text style={styles.commissionBadge}>
                            شامل {Math.round(getRelatedCommission(movement, movements))} عمولة
                          </Text>
                        )}
                        <Text style={styles.movementLabel}>
                          {(movement as any).is_internal_transfer
                            ? 'تحويل'
                            : movement.movement_type === 'outgoing'
                              ? 'من العميل'
                              : 'للعميل'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ),
            )
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleAddMovement}>
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {customer && (
        <QuickAddMovementSheet
          visible={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          customerId={customer.id}
          customerName={customer.name}
          customerAccountNumber={customer.account_number}
          currentBalances={currencyBalances}
          onSuccess={() => {
            loadCustomerData();
          }}
        />
      )}

      <Modal
        visible={showSettingsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsMenu(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إدارة العميل</Text>
            <Text style={styles.modalSubtitle}>{customer?.name}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSettingsMenu(false);
                router.push({
                  pathname: '/add-customer',
                  params: { id: customer.id },
                });
              }}
            >
              <Text style={styles.menuItemText}>تعديل البيانات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSettingsMenu(false);
                handleWhatsApp();
              }}
            >
              <Text style={styles.menuItemText}>إرسال واتساب</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSettingsMenu(false);
                handleCall();
              }}
            >
              <Text style={styles.menuItemText}>اتصال</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItemDanger}
              onPress={() => {
                setShowSettingsMenu(false);
                handleResetAccount();
              }}
            >
              <Text style={styles.menuItemDangerText}>تصفير الحساب</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemDanger}
              onPress={() => {
                setShowSettingsMenu(false);
                handleDeleteCustomer();
              }}
            >
              <Text style={styles.menuItemDangerText}>حذف العميل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItemCancel}
              onPress={() => setShowSettingsMenu(false)}
            >
              <Text style={styles.menuItemCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  gradientHeader: {
    paddingTop: 56,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerInfo: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  summarySection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  summaryMainText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 24,
    textAlign: 'right',
  },
  summaryMainAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLineGreen: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 6,
    lineHeight: 22,
    textAlign: 'right',
  },
  summaryAmountGreen: {
    fontWeight: '700',
    color: '#10B981',
  },
  summaryLineRed: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 6,
    lineHeight: 22,
    textAlign: 'right',
  },
  summaryAmountRed: {
    fontWeight: '700',
    color: '#EF4444',
  },
  currencyBalanceContainer: {
    marginBottom: 8,
  },
  currencyDetailsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingVertical: 12,
  },
  currencyDetailsToggle: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  currencyDetailsToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  currencyDetailsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  currencyDetailsContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  currencyDetailsCard: {
    marginBottom: 8,
  },
  currencyDetailsName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'right',
  },
  currencyDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  currencyDetailsLabelGreen: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'right',
  },
  currencyDetailsLabelRed: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'right',
  },
  currencyDetailsValueGreen: {
    fontSize: 12,
    fontWeight: '400',
    color: '#10B981',
    textAlign: 'left',
  },
  currencyDetailsValueRed: {
    fontSize: 12,
    fontWeight: '400',
    color: '#EF4444',
    textAlign: 'left',
  },
  tabButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
    flexWrap: 'wrap',
  },
  tabButtonPrimary: {
    backgroundColor: '#F97316',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 140,
  },
  tabButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  tabButtonDisabled: {
    opacity: 0.5,
  },
  tabButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  movementsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingBottom: 100,
  },
  monthHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    textAlign: 'right',
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  movementDate: {
    alignItems: 'center',
    width: 50,
  },
  movementDateMonth: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  movementDateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  movementNumberContainer: {
    justifyContent: 'center',
    marginLeft: 12,
    width: 60,
  },
  movementNumber: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  movementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 0,
    marginRight: 2,
  },
  currencySymbolText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  movementTypeContainer: {
    justifyContent: 'center',
    marginLeft: 4,
    maxWidth: 60,
  },
  movementType: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  movementNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  spacer: {
    flex: 1,
  },
  movementAmount: {
    alignItems: 'flex-end',
    width: 70,
    marginLeft: 2,
  },
  movementAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  movementLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  commissionBadge: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'right',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'right',
  },
  menuItemDanger: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemDangerText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'right',
    fontWeight: '600',
  },
  menuItemCancel: {
    paddingVertical: 16,
    marginTop: 8,
  },
  menuItemCancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  menuDivider: {
    height: 8,
    backgroundColor: '#F9FAFB',
    marginVertical: 8,
    marginHorizontal: -20,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
