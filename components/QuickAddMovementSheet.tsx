import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Save,
  Printer,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Currency, CURRENCIES } from '@/types/database';
import { useRouter } from 'expo-router';
import { useDataRefresh } from '@/contexts/DataRefreshContext';

interface QuickAddMovementSheetProps {
  visible: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerAccountNumber: string;
  currentBalances: Array<{
    currency: string;
    balance: number;
  }>;
  onSuccess: () => void;
}

export default function QuickAddMovementSheet({
  visible,
  onClose,
  customerId,
  customerName,
  customerAccountNumber,
  currentBalances,
  onSuccess,
}: QuickAddMovementSheetProps) {
  const router = useRouter();
  const { triggerRefresh } = useDataRefresh();
  const [movementType, setMovementType] = useState<
    'incoming' | 'outgoing' | ''
  >('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [notes, setNotes] = useState('');
  const [showCommission, setShowCommission] = useState(false);
  const [commission, setCommission] = useState('');
  const [commissionCurrency, setCommissionCurrency] = useState<Currency>('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    console.log('[QuickAddMovementSheet] visible changed:', visible);
    if (visible) {
      loadLastUsedCurrency();
    } else {
      resetForm();
    }
  }, [visible]);

  useEffect(() => {
    setCommissionCurrency(currency);
  }, [currency]);

  useEffect(() => {
    if (movementType === 'outgoing') {
      setShowCommission(false);
      setCommission('');
    }
  }, [movementType]);

  const loadLastUsedCurrency = async () => {
    try {
      const lastCurrency = await AsyncStorage.getItem('@last_used_currency');
      if (lastCurrency) {
        setCurrency(lastCurrency as Currency);
      }
    } catch (error) {
      console.error('Error loading last currency:', error);
    }
  };

  const saveLastUsedCurrency = async (curr: Currency) => {
    try {
      await AsyncStorage.setItem('@last_used_currency', curr);
    } catch (error) {
      console.error('Error saving last currency:', error);
    }
  };

  const resetForm = () => {
    setMovementType('');
    setAmount('');
    setNotes('');
    setShowCommission(false);
    setCommission('');
  };

  const getCurrencySymbol = (code: string) => {
    const curr = CURRENCIES.find((c) => c.code === code);
    return curr?.symbol || code;
  };

  const calculateNewBalance = () => {
    const amountNum = parseFloat(amount) || 0;
    const commissionAmount = movementType === 'incoming' && commission ? parseFloat(commission) : 0;
    const currentBalance =
      currentBalances.find((b) => b.currency === currency)?.balance || 0;

    let actualAmount = amountNum;

    // إذا كانت العمولة من نفس العملة، نطبق الخصم/الإضافة
    if (commissionAmount > 0 && commissionCurrency === currency && movementType === 'incoming') {
      // له: نخصم العمولة من المبلغ
      actualAmount = amountNum - commissionAmount;
    }

    if (movementType === 'incoming') {
      return currentBalance + actualAmount;
    } else if (movementType === 'outgoing') {
      return currentBalance - actualAmount;
    }
    return currentBalance;
  };

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    if (balance > 0) {
      return `له عندنا: ${absBalance.toFixed(2)} ${getCurrencySymbol(currency)}`;
    } else if (balance < 0) {
      return `لنا عنده: ${absBalance.toFixed(2)} ${getCurrencySymbol(currency)}`;
    }
    return `متساوي`;
  };

  const handleSave = async (withPrint: boolean = false) => {
    if (!movementType || !amount || parseFloat(amount) <= 0) {
      Alert.alert('خطأ', 'الرجاء إدخال نوع الحركة والمبلغ');
      return;
    }

    setIsLoading(true);
    try {
      const { data: movementNumber } = await supabase.rpc(
        'generate_movement_number',
      );
      const { data: transferNumber } = await supabase.rpc(
        'generate_transfer_number',
      );

      // حساب المبلغ الفعلي بعد خصم/إضافة العمولة
      const baseAmount = parseFloat(amount);
      const commissionAmount = movementType === 'incoming' && commission ? parseFloat(commission) : 0;
      let actualAmount = baseAmount;

      // إذا كانت العمولة من نفس العملة، نطبق الخصم/الإضافة
      if (commissionAmount > 0 && commissionCurrency === currency && movementType === 'incoming') {
        // له: نخصم العمولة من المبلغ
        actualAmount = baseAmount - commissionAmount;
      }

      const { data: insertedData, error } = await supabase
        .from('account_movements')
        .insert([
          {
            movement_number: movementNumber || `MOV-${Date.now()}`,
            customer_id: customerId,
            movement_type: movementType,
            amount: actualAmount,
            currency: currency,
            commission: movementType === 'incoming' && commission ? parseFloat(commission) : null,
            commission_currency: commissionCurrency,
            notes: notes.trim() || null,
            sender_name:
              movementType === 'outgoing'
                ? customerName
                : 'علي هادي علي الرازحي',
            beneficiary_name:
              movementType === 'outgoing'
                ? 'علي هادي علي الرازحي'
                : customerName,
            transfer_number: transferNumber || null,
            is_internal_transfer: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await saveLastUsedCurrency(currency);
      triggerRefresh('movements');

      // إغلاق الـ modal مباشرة لتجنب مشكلة تكرار الرصيد
      onClose();

      // استدعاء onSuccess بعد إغلاق الـ modal
      onSuccess();

      if (withPrint) {
        router.push({
          pathname: '/receipt-preview',
          params: {
            movementId: insertedData.id,
            customerName: customerName,
            customerAccountNumber: customerAccountNumber,
          },
        });
      }
    } catch (error) {
      console.error('Error adding movement:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إضافة الحركة');
    } finally {
      setIsLoading(false);
    }
  };

  const currentBalance =
    currentBalances.find((b) => b.currency === currency)?.balance || 0;
  const newBalance = calculateNewBalance();

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.sheetContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              style={styles.keyboardView}
            >
              <View style={styles.sheet}>
                <View style={styles.header}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>إضافة حركة</Text>
                  <View style={{ width: 32 }} />
                </View>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.content}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  scrollEventThrottle={16}
                >
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      نوع الحركة <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.typeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.typeButton,
                          movementType === 'outgoing' &&
                            styles.typeButtonActiveRed,
                        ]}
                        onPress={() => setMovementType('outgoing')}
                      >
                        <ArrowDownCircle
                          size={24}
                          color={
                            movementType === 'outgoing' ? '#FFFFFF' : '#EF4444'
                          }
                        />
                        <Text
                          style={[
                            styles.typeButtonText,
                            {
                              color:
                                movementType === 'outgoing'
                                  ? '#FFFFFF'
                                  : '#EF4444',
                            },
                          ]}
                        >
                          عليه
                        </Text>
                        <Text
                          style={[
                            styles.typeButtonSubtext,
                            {
                              color:
                                movementType === 'outgoing'
                                  ? '#FECACA'
                                  : '#FCA5A5',
                            },
                          ]}
                        >
                          قبض
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeButton,
                          movementType === 'incoming' &&
                            styles.typeButtonActiveGreen,
                        ]}
                        onPress={() => setMovementType('incoming')}
                      >
                        <ArrowUpCircle
                          size={24}
                          color={
                            movementType === 'incoming' ? '#FFFFFF' : '#10B981'
                          }
                        />
                        <Text
                          style={[
                            styles.typeButtonText,
                            {
                              color:
                                movementType === 'incoming'
                                  ? '#FFFFFF'
                                  : '#10B981',
                            },
                          ]}
                        >
                          له
                        </Text>
                        <Text
                          style={[
                            styles.typeButtonSubtext,
                            {
                              color:
                                movementType === 'incoming'
                                  ? '#D1FAE5'
                                  : '#6EE7B7',
                            },
                          ]}
                        >
                          صرف
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      المبلغ <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.amountRow}>
                      <TouchableOpacity
                        style={styles.currencyButton}
                        onPress={() => setShowCurrencyPicker(true)}
                      >
                        <Text style={styles.currencyCode}>{currency}</Text>
                        <Text style={styles.currencySymbol}>
                          {getCurrencySymbol(currency)}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {movementType === 'incoming' && (
                    !showCommission ? (
                      <TouchableOpacity
                        style={styles.addCommissionButton}
                        onPress={() => setShowCommission(true)}
                      >
                        <Plus size={16} color="#3B82F6" />
                        <Text style={styles.addCommissionText}>إضافة عمولة</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.section}>
                        <View style={styles.commissionHeader}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowCommission(false);
                              setCommission('');
                            }}
                          >
                            <X size={18} color="#EF4444" />
                          </TouchableOpacity>
                          <Text style={styles.sectionTitle}>عمولة</Text>
                        </View>
                        <View style={styles.amountRow}>
                          <View style={styles.commissionCurrencyDisplay}>
                            <Text style={styles.currencyCode}>
                              {commissionCurrency}
                            </Text>
                            <Text style={styles.currencySymbol}>
                              {getCurrencySymbol(commissionCurrency)}
                            </Text>
                          </View>
                          <TextInput
                            style={styles.amountInput}
                            value={commission}
                            onChangeText={setCommission}
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                    )
                  )}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ملاحظة (اختياري)</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="أضف ملاحظة"
                      placeholderTextColor="#9CA3AF"
                      textAlign="right"
                    />
                  </View>

                  {amount && movementType && (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewTitle}>معاينة الأثر</Text>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewValue}>
                          {formatBalance(currentBalance)}
                        </Text>
                        <Text style={styles.previewLabel}>الرصيد قبل:</Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text
                          style={[
                            styles.previewValue,
                            styles.previewValueBold,
                            { color: newBalance > 0 ? '#10B981' : newBalance < 0 ? '#EF4444' : '#6B7280' },
                          ]}
                        >
                          {formatBalance(newBalance)}
                        </Text>
                        <Text style={styles.previewLabel}>الرصيد بعد:</Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      isLoading && styles.saveButtonDisabled,
                    ]}
                    onPress={() => handleSave(false)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Save size={20} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>حفظ</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.savePrintButton,
                      isLoading && styles.saveButtonDisabled,
                    ]}
                    onPress={() => handleSave(true)}
                    disabled={isLoading}
                  >
                    <Printer size={18} color="#3B82F6" />
                    <Text style={styles.savePrintButtonText}>حفظ + طباعة</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>اختر العملة</Text>
            <ScrollView style={styles.pickerList}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={styles.pickerItem}
                  onPress={() => {
                    setCurrency(curr.code);
                    setShowCurrencyPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {curr.code} - {curr.name}
                  </Text>
                  <Text style={styles.pickerItemSymbol}>{curr.symbol}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCloseButton}
              onPress={() => setShowCurrencyPicker(false)}
            >
              <Text style={styles.pickerCloseButtonText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    height: '90%',
  },
  keyboardView: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '100%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    textAlign: 'right',
  },
  required: {
    color: '#EF4444',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeButtonActiveRed: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  typeButtonActiveGreen: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  typeButtonSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  currencyButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 14,
    width: 90,
    alignItems: 'center',
  },
  commissionCurrencyDisplay: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 14,
    width: 90,
    alignItems: 'center',
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  currencySymbol: {
    fontSize: 12,
    color: '#E0E7FF',
    marginTop: 2,
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  addCommissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addCommissionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  previewSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  previewValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  savePrintButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  savePrintButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
  },
  pickerItemSymbol: {
    fontSize: 14,
    color: '#6B7280',
  },
  pickerCloseButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  pickerCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});
