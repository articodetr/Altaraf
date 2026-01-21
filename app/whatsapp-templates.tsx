import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Save, RotateCcw, Eye, Info } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_ACCOUNT_STATEMENT_TEMPLATE,
  DEFAULT_TRANSACTION_TEMPLATE,
  AVAILABLE_VARIABLES,
  processAccountStatementTemplate,
  processTransactionTemplate,
} from '@/utils/whatsappTemplateHelper';

export default function WhatsAppTemplatesScreen() {
  const router = useRouter();
  const { settings, refreshSettings } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [accountStatementTemplate, setAccountStatementTemplate] = useState('');
  const [transactionTemplate, setTransactionTemplate] = useState('');

  const [showAccountPreview, setShowAccountPreview] = useState(false);
  const [showTransactionPreview, setShowTransactionPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [settings]);

  const loadTemplates = () => {
    if (settings) {
      setAccountStatementTemplate(
        settings.whatsapp_account_statement_template || DEFAULT_ACCOUNT_STATEMENT_TEMPLATE
      );
      setTransactionTemplate(
        settings.whatsapp_transaction_template || DEFAULT_TRANSACTION_TEMPLATE
      );
    }
  };

  const handleSave = async () => {
    if (!accountStatementTemplate.trim() || !transactionTemplate.trim()) {
      Alert.alert('تنبيه', 'لا يمكن ترك القوالب فارغة');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('app_settings')
        .update({
          whatsapp_account_statement_template: accountStatementTemplate,
          whatsapp_transaction_template: transactionTemplate,
        })
        .eq('id', settings?.id);

      if (error) throw error;

      await refreshSettings();
      Alert.alert('نجح', 'تم حفظ القوالب بنجاح');
    } catch (error) {
      console.error('Error saving templates:', error);
      Alert.alert('خطأ', 'فشل في حفظ القوالب');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'استعادة القيم الافتراضية',
      'هل أنت متأكد من استعادة القوالب الافتراضية؟ سيتم فقدان التعديلات الحالية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استعادة',
          style: 'destructive',
          onPress: () => {
            setAccountStatementTemplate(DEFAULT_ACCOUNT_STATEMENT_TEMPLATE);
            setTransactionTemplate(DEFAULT_TRANSACTION_TEMPLATE);
          },
        },
      ]
    );
  };

  const getAccountPreview = () => {
    return processAccountStatementTemplate(accountStatementTemplate, {
      customerName: 'محمد أحمد',
      accountNumber: 'ACC-001',
      balance: 'رصيدك الحالي:\n1,500.00 $ (لك)\n200,000 ريال (عليك)',
      shopName: settings?.shop_name || 'محل الحوالات المالية',
      shopPhone: settings?.shop_phone || '777123456',
    });
  };

  const getTransactionPreview = () => {
    return processTransactionTemplate(transactionTemplate, {
      customerName: 'محمد أحمد',
      transactionNumber: 'TRX-12345',
      amountSent: '1,000.00',
      amountReceived: '800,000',
      currencySent: 'USD',
      currencyReceived: 'YER',
      shopName: settings?.shop_name || 'محل الحوالات المالية',
      shopPhone: settings?.shop_phone || '777123456',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowRight size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>قوالب رسائل الواتساب</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Info size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            يمكنك تخصيص الرسائل التي يتم إرسالها للعملاء عبر الواتساب باستخدام المتغيرات
            المتاحة أدناه.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>قالب رسالة كشف الحساب</Text>
          <Text style={styles.sectionDescription}>
            الرسالة التي يتم إرسالها عند الضغط على زر الواتساب من صفحة تفاصيل العميل
          </Text>

          <View style={styles.templateCard}>
            <TextInput
              style={styles.templateInput}
              value={accountStatementTemplate}
              onChangeText={setAccountStatementTemplate}
              multiline
              placeholder="أدخل قالب الرسالة..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          <View style={styles.variablesCard}>
            <Text style={styles.variablesTitle}>المتغيرات المتاحة:</Text>
            {AVAILABLE_VARIABLES.accountStatement.map((item, index) => (
              <View key={index} style={styles.variableItem}>
                <Text style={styles.variableCode}>{item.variable}</Text>
                <Text style={styles.variableDescription}>{item.description}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setShowAccountPreview(!showAccountPreview)}
          >
            <Eye size={18} color="#3B82F6" />
            <Text style={styles.previewButtonText}>
              {showAccountPreview ? 'إخفاء المعاينة' : 'معاينة الرسالة'}
            </Text>
          </TouchableOpacity>

          {showAccountPreview && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>معاينة:</Text>
              <Text style={styles.previewText}>{getAccountPreview()}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>قالب رسالة تفاصيل الحوالة</Text>
          <Text style={styles.sectionDescription}>
            الرسالة التي يتم إرسالها عند الضغط على زر الواتساب من صفحة تفاصيل الحوالة
          </Text>

          <View style={styles.templateCard}>
            <TextInput
              style={styles.templateInput}
              value={transactionTemplate}
              onChangeText={setTransactionTemplate}
              multiline
              placeholder="أدخل قالب الرسالة..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          <View style={styles.variablesCard}>
            <Text style={styles.variablesTitle}>المتغيرات المتاحة:</Text>
            {AVAILABLE_VARIABLES.transaction.map((item, index) => (
              <View key={index} style={styles.variableItem}>
                <Text style={styles.variableCode}>{item.variable}</Text>
                <Text style={styles.variableDescription}>{item.description}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setShowTransactionPreview(!showTransactionPreview)}
          >
            <Eye size={18} color="#3B82F6" />
            <Text style={styles.previewButtonText}>
              {showTransactionPreview ? 'إخفاء المعاينة' : 'معاينة الرسالة'}
            </Text>
          </TouchableOpacity>

          {showTransactionPreview && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>معاينة:</Text>
              <Text style={styles.previewText}>{getTransactionPreview()}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={handleReset}
            disabled={saving}
          >
            <RotateCcw size={20} color="#EF4444" />
            <Text style={styles.resetButtonText}>استعادة الافتراضي</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>نصائح:</Text>
          <Text style={styles.tipText}>• استخدم المتغيرات بين أقواس معقوفة {'{}'}</Text>
          <Text style={styles.tipText}>
            • يمكنك حذف أي متغير لا تحتاجه من القالب
          </Text>
          <Text style={styles.tipText}>• يمكنك إضافة نص ثابت بجانب المتغيرات</Text>
          <Text style={styles.tipText}>
            • اضغط على معاينة الرسالة للتأكد من الشكل النهائي
          </Text>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    textAlign: 'right',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'right',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'right',
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    marginBottom: 12,
  },
  templateInput: {
    fontSize: 14,
    color: '#111827',
    minHeight: 150,
    padding: 12,
    textAlign: 'right',
  },
  variablesCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  variablesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'right',
  },
  variableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  variableCode: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  variableDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'right',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'right',
  },
  previewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    textAlign: 'right',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resetButton: {
    backgroundColor: '#FEE2E2',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 32,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
    textAlign: 'right',
  },
  tipText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 22,
    textAlign: 'right',
    marginBottom: 4,
  },
});
