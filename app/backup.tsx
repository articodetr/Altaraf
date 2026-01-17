import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Download, Upload, Database, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function BackupScreen() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const [customers, transactions, debts, exchangeRates] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('debts').select('*'),
        supabase.from('exchange_rates').select('*'),
      ]);

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers: customers.data || [],
          transactions: transactions.data || [],
          debts: debts.data || [],
          exchange_rates: exchangeRates.data || [],
        },
      };

      Alert.alert(
        'نجح',
        'تم إنشاء النسخة الاحتياطية بنجاح!\n\nميزة التصدير والمشاركة ستكون متاحة قريباً.',
        [{ text: 'حسناً' }]
      );
      setLastBackup(new Date().toISOString());

      console.log('Backup data created:', JSON.stringify(backupData, null, 2));
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    Alert.alert('قريباً', 'ميزة استيراد البيانات قيد التطوير');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowRight size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>النسخ الاحتياطي</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Database size={48} color="#4F46E5" />
          <Text style={styles.infoTitle}>النسخ الاحتياطي للبيانات</Text>
          <Text style={styles.infoText}>
            قم بحفظ نسخة احتياطية من جميع بياناتك لضمان عدم فقدانها. يمكنك تصدير البيانات
            بصيغة JSON ومشاركتها أو حفظها في مكان آمن.
          </Text>
          {lastBackup && (
            <View style={styles.lastBackupContainer}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.lastBackupText}>
                آخر نسخة احتياطية:{' '}
                {new Date(lastBackup).toLocaleDateString('ar-EG')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#EEF2FF' }]}
            onPress={handleExportData}
            disabled={isExporting}
          >
            <Download size={40} color="#4F46E5" />
            <Text style={styles.actionTitle}>تصدير البيانات</Text>
            <Text style={styles.actionDescription}>
              {isExporting ? 'جاري التصدير...' : 'تصدير نسخة من جميع البيانات'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#ECFDF5' }]}
            onPress={handleImportData}
          >
            <Upload size={40} color="#10B981" />
            <Text style={styles.actionTitle}>استيراد البيانات</Text>
            <Text style={styles.actionDescription}>استعادة البيانات من نسخة احتياطية</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>تنبيه هام</Text>
          <Text style={styles.warningText}>
            • احتفظ بنسخ احتياطية منتظمة من بياناتك{'\n'}
            • احفظ الملفات في مكان آمن{'\n'}
            • تأكد من صحة البيانات قبل الاستيراد{'\n'}
            • لا تشارك ملفات النسخ الاحتياطي مع جهات غير موثوقة
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
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  lastBackupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  lastBackupText: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
    textAlign: 'right',
  },
  warningText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 22,
    textAlign: 'right',
  },
});
