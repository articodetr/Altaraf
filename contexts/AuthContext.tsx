import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { AppSettings } from '@/types/database';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: { userName: string; role: string; userId: string } | null;
  login: (userName: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = '@money_transfer_auth';
const USER_KEY = '@money_transfer_current_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentUser, setCurrentUser] = useState<{ userName: string; role: string; userId: string } | null>(null);

  const loadSettings = async () => {
    try {
      const FIXED_SETTINGS_ID = '00000000-0000-0000-0000-000000000000';
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', FIXED_SETTINGS_ID)
        .maybeSingle();

      if (!error && data) {
        setSettings(data);
        return;
      }

      if (!error && !data) {
        // Create default settings if none exist
        const defaultSettings = {
          shop_name: 'الترف للحوالات المالية',
          shop_phone: '',
          shop_address: '',
        };

        const { data: newSettings } = await supabase
          .from('app_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (newSettings) {
          setSettings(newSettings);
          return;
        }
      }

      // If we get here, set default settings
      setSettings({
        id: '',
        shop_name: 'الترف للحوالات المالية',
        shop_phone: '',
        shop_address: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        selected_receipt_logo: null,
      } as any);
    } catch (error) {
      console.error('Error loading settings:', error);
      // Set default settings on error
      setSettings({
        id: '',
        shop_name: 'الترف للحوالات المالية',
        shop_phone: '',
        shop_address: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        selected_receipt_logo: null,
      } as any);
    }
  };

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  const checkAuth = async () => {
    try {
      const authValue = await AsyncStorage.getItem(AUTH_KEY);
      const userValue = await AsyncStorage.getItem(USER_KEY);

      if (authValue === 'true' && userValue) {
        setIsAuthenticated(true);
        setCurrentUser(JSON.parse(userValue));
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userName: string, pin: string): Promise<boolean> => {
    try {
      if (!settings) {
        await loadSettings();
      }

      const hashHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
      );

      const { data, error } = await supabase
        .from('app_security')
        .select('id, pin_hash, is_active, role, user_name')
        .eq('user_name', userName)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      if (!data.is_active) {
        return false;
      }

      if (data.pin_hash === hashHex) {
        await supabase
          .from('app_security')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.id);

        const user = {
          userName: data.user_name,
          role: data.role,
          userId: data.id,
        };

        await AsyncStorage.setItem(AUTH_KEY, 'true');
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        setCurrentUser(user);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      console.log('[AuthContext] updateSettings called with:', JSON.stringify(newSettings, null, 2));

      if (newSettings.shop_logo !== undefined && currentUser?.role !== 'admin') {
        console.error('[AuthContext] Non-admin user attempted to update shop logo');
        return false;
      }

      const FIXED_ID = '00000000-0000-0000-0000-000000000000';

      const settingsToUpsert = {
        id: FIXED_ID,
        ...newSettings,
      };

      console.log('[AuthContext] Performing upsert with data:', JSON.stringify(settingsToUpsert, null, 2));

      const { data, error: upsertError } = await supabase
        .from('app_settings')
        .upsert(settingsToUpsert, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        console.error('[AuthContext] Upsert error:', upsertError);
        console.error('[AuthContext] Error code:', upsertError.code);
        console.error('[AuthContext] Error message:', upsertError.message);
        console.error('[AuthContext] Error details:', JSON.stringify(upsertError, null, 2));
        throw upsertError;
      }

      console.log('[AuthContext] Settings upserted successfully:', data);

      await loadSettings();
      console.log('[AuthContext] Settings reloaded');
      return true;
    } catch (error) {
      console.error('[AuthContext] Error updating settings:', error);
      if (error instanceof Error) {
        console.error('[AuthContext] Error name:', error.name);
        console.error('[AuthContext] Error message:', error.message);
        console.error('[AuthContext] Error stack:', error.stack);
      }
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentUser,
        login,
        logout,
        settings,
        refreshSettings,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return default values during initialization
    return {
      isAuthenticated: false,
      isLoading: true,
      currentUser: null,
      login: async (_userName: string, _pin: string) => false,
      logout: async () => {},
      settings: null,
      refreshSettings: async () => {},
      updateSettings: async () => false,
    };
  }
  return context;
}
