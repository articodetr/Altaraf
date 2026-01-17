import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { Asset } from 'expo-asset';

const DEFAULT_LOGO_ASSET = require('../assets/images/logo_1.png');
const BUCKET_NAME = 'shop-logos';
const FIXED_SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

async function getBundledLogoAsDataUrl(): Promise<string> {
  try {
    console.log('[logoHelper] Loading bundled logo from assets...');
    const asset = Asset.fromModule(DEFAULT_LOGO_ASSET);

    if (!asset.downloaded) {
      console.log('[logoHelper] Downloading asset...');
      await asset.downloadAsync();
    }

    console.log('[logoHelper] Asset downloaded - URI:', asset.uri);

    if (Platform.OS === 'web') {
      console.log('[logoHelper] Platform is web, returning asset URI');
      return asset.uri;
    }

    const localPath = asset.localUri || asset.uri;
    if (!localPath) {
      console.error('[logoHelper] No local path available for asset');
      return '';
    }

    console.log('[logoHelper] Reading asset as base64 from:', localPath);
    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64) {
      console.error('[logoHelper] Empty base64 result');
      return '';
    }

    console.log('[logoHelper] Successfully loaded bundled logo, length:', base64.length);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('[logoHelper] Error loading bundled logo:', error);
    return '';
  }
}

async function downloadAndConvertLogoToBase64(logoUrl: string): Promise<string | null> {
  try {
    console.log('[logoHelper] Downloading logo from Storage:', logoUrl);

    if (Platform.OS === 'web') {
      console.log('[logoHelper] Platform is web, returning URL directly');
      return logoUrl;
    }

    const tempPath = `${FileSystem.cacheDirectory}temp_logo_${Date.now()}.jpg`;

    const downloadResult = await FileSystem.downloadAsync(logoUrl, tempPath);

    if (downloadResult.status !== 200) {
      console.error('[logoHelper] Download failed with status:', downloadResult.status);
      return null;
    }

    console.log('[logoHelper] Logo downloaded to:', downloadResult.uri);

    const base64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64) {
      console.error('[logoHelper] Empty base64 after download');
      return null;
    }

    const fileExt = logoUrl.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    console.log('[logoHelper] Successfully converted uploaded logo to base64, length:', base64.length);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[logoHelper] Error downloading/converting logo:', error);
    return null;
  }
}

export async function getReceiptLogoBase64(forceRefresh = false): Promise<string> {
  try {
    console.log('[logoHelper] getReceiptLogoBase64 called, forceRefresh:', forceRefresh);

    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('selected_receipt_logo, shop_logo')
      .eq('id', FIXED_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.error('[logoHelper] Error fetching settings:', error);
      console.log('[logoHelper] Falling back to bundled logo');
      return await getBundledLogoAsDataUrl();
    }

    if (!settings) {
      console.log('[logoHelper] No settings found, using bundled logo');
      return await getBundledLogoAsDataUrl();
    }

    console.log('[logoHelper] Settings loaded:', {
      selected_receipt_logo: settings.selected_receipt_logo,
      shop_logo: settings.shop_logo,
    });

    if (settings.selected_receipt_logo === 'DEFAULT') {
      console.log('[logoHelper] User selected DEFAULT logo, using bundled logo');
      return await getBundledLogoAsDataUrl();
    }

    const logoUrl = settings.selected_receipt_logo || settings.shop_logo;

    if (!logoUrl || logoUrl === 'DEFAULT') {
      console.log('[logoHelper] No uploaded logo URL found, using bundled logo');
      return await getBundledLogoAsDataUrl();
    }

    if (logoUrl.includes(BUCKET_NAME)) {
      console.log('[logoHelper] Found uploaded logo in Supabase Storage');
      const base64Logo = await downloadAndConvertLogoToBase64(logoUrl);

      if (base64Logo) {
        return base64Logo;
      } else {
        console.log('[logoHelper] Failed to download uploaded logo, falling back to bundled');
        return await getBundledLogoAsDataUrl();
      }
    }

    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      console.log('[logoHelper] Found external logo URL:', logoUrl);
      const base64Logo = await downloadAndConvertLogoToBase64(logoUrl);

      if (base64Logo) {
        return base64Logo;
      } else {
        console.log('[logoHelper] Failed to download external logo, falling back to bundled');
        return await getBundledLogoAsDataUrl();
      }
    }

    console.log('[logoHelper] Unrecognized logo format, using bundled logo');
    return await getBundledLogoAsDataUrl();
  } catch (error) {
    console.error('[logoHelper] Error in getReceiptLogoBase64:', error);
    console.log('[logoHelper] Falling back to bundled logo');
    return await getBundledLogoAsDataUrl();
  }
}

export async function getLogoUrl(): Promise<string> {
  try {
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('shop_logo')
      .eq('id', FIXED_SETTINGS_ID)
      .maybeSingle();

    if (error || !settings?.shop_logo) {
      const asset = Asset.fromModule(DEFAULT_LOGO_ASSET);
      if (!asset.downloaded) {
        await asset.downloadAsync();
      }
      return asset.localUri || asset.uri;
    }

    return settings.shop_logo;
  } catch (error) {
    console.error('[logoHelper] Error getting logo URL:', error);
    const asset = Asset.fromModule(DEFAULT_LOGO_ASSET);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }
    return asset.localUri || asset.uri;
  }
}

export async function getLogoBase64(forceRefresh = false): Promise<string> {
  return getReceiptLogoBase64(forceRefresh);
}

export async function clearLogoCache(): Promise<void> {
  try {
    console.log('[logoHelper] Clearing logo cache');
    if (Platform.OS !== 'web') {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const logoFiles = files.filter(f => f.startsWith('temp_logo_'));

        for (const file of logoFiles) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
        }

        console.log('[logoHelper] Cleared', logoFiles.length, 'cached logo files');
      }
    }
  } catch (error) {
    console.error('[logoHelper] Error clearing logo cache:', error);
  }
}
