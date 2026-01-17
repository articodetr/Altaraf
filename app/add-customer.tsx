import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Save } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

export default function AddCustomerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(!!id);
  const [isEditMode, setIsEditMode] = useState(!!id);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      setIsLoadingData(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        Alert.alert('خطأ', 'لم يتم العثور على العميل');
        router.back();
        return;
      }

      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        notes: data.notes || '',
      });
    } catch (error) {
      console.error('Error loading customer:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال الاسم ورقم الهاتف');
      return;
    }

    setIsLoading(true);
    try {
      if (isEditMode && id) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
          })
          .eq('id', id);

        if (error) throw error;

        Alert.alert('نجح', 'تم تحديث بيانات العميل بنجاح', [
          {
            text: 'حسناً',
            onPress: () => router.back(),
          },
        ]);
      } else {
        const { error } = await supabase.from('customers').insert([
          {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            balance: 0,
          },
        ]);

        if (error) throw error;

        Alert.alert('نجح', 'تم إضافة العميل بنجاح', [
          {
            text: 'حسناً',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      Alert.alert('خطأ', `حدث خطأ أثناء ${isEditMode ? 'تحديث' : 'إضافة'} العميل`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowRight size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'تعديل العميل' : 'إضافة عميل جديد'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowRight size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'تعديل العميل' : 'إضافة عميل جديد'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareView
        contentContainerStyle={styles.contentContainer}
        extraScrollHeight={180}
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            الاسم <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="أدخل اسم العميل"
            placeholderTextColor="#9CA3AF"
            textAlign="right"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            رقم الهاتف <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="أدخل رقم الهاتف"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            textAlign="right"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="أدخل البريد الإلكتروني"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            textAlign="right"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>العنوان</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="أدخل العنوان"
            placeholderTextColor="#9CA3AF"
            textAlign="right"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>ملاحظات</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="أدخل ملاحظات إضافية"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Save size={20} color="#FFFFFF" />
          <Text style={styles.submitButtonText}>
            {isLoading ? 'جاري الحفظ...' : (isEditMode ? 'حفظ التعديلات' : 'حفظ العميل')}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 50,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
