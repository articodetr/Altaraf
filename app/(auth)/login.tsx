import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User } from 'lucide-react-native';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

export default function LoginScreen() {
  const [userName, setUserName] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!userName.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم المستخدم');
      return;
    }

    if (pin.length < 8) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    if (pin.length > 16) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن لا تزيد عن 16 حرف');
      return;
    }

    setIsLoading(true);
    const success = await login(userName.trim(), pin);
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('خطأ', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      setPin('');
    }
  };

  return (
    <KeyboardAwareView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <Lock size={64} color="#4F46E5" />
          </View>

          <Text style={styles.title}>نظام إدارة الحوالات المالية</Text>
          <Text style={styles.subtitle}>أدخل بياناتك للدخول</Text>

          <View style={styles.inputContainer}>
            <User size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={userName}
              onChangeText={setUserName}
              placeholder="اسم المستخدم"
              placeholderTextColor="#9CA3AF"
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(text) => {
                if (text.length <= 16) {
                  setPin(text);
                }
              }}
              placeholder="كلمة المرور (8-16 حرف)"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              maxLength={16}
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {pin.length > 0 && (
            <View style={styles.lengthIndicator}>
              <Text style={[
                styles.lengthText,
                pin.length >= 8 && pin.length <= 16 ? styles.lengthTextValid : styles.lengthTextInvalid
              ]}>
                {pin.length} / 16 حرف
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'جاري التحقق...' : 'دخول'}
            </Text>
          </TouchableOpacity>
    </KeyboardAwareView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 64,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  lengthIndicator: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
  },
  lengthText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  lengthTextValid: {
    color: '#10B981',
  },
  lengthTextInvalid: {
    color: '#F59E0B',
  },
});
