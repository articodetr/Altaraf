es_by_currency CASCADE;
CREATE OR REPLACE VIEW customer_balances_by_currency AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  am.currency,
  COALESCE(SUM(CASE WHEN am.movement_type = 'incoming' THEN am.amount ELSE 0 END), 0) AS total_incoming,
  COALESCE(SUM(CASE WHEN am.movement_type = 'outgoing' THEN am.amount ELSE 0 END), 0) AS total_outgoing,
  COALESCE(
    SUM(
      CASE
        WHEN am.movement_type = 'incoming' THEN am.amount
        WHEN am.movement_type = 'outgoing' THEN -am.amount
        ELSE 0
      END
    ),
    0
  ) AS balance
FROM customers c
LEFT JOIN account_movements am ON c.id = am.customer_id
WHERE am.currency IS NOT NULL
GROUP BY c.id, c.name, am.currency
HAVING COALESCE(
    SUM(
      CASE
        WHEN am.movement_type = 'incoming' THEN am.amount
        WHEN am.movement_type = 'outgoing' THEN -am.amount
        ELSE 0
      END
    ),
    0
  ) <> 0
ORDER BY c.name, abs(COALESCE(
    SUM(
      CASE
        WHEN am.movement_type = 'incoming' THEN am.amount
        WHEN am.movement_type = 'outgoing' THEN -am.amount
        ELSE 0
      END
    ),
    0
  )) DESC;

-- 5.2 View العملاء مع آخر نشاط
DROP VIEW IF EXISTS customers_with_last_activity CASCADE;
CREATE OR REPLACE VIEW customers_with_last_activity AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.notes,
  c.created_at,
  c.account_number,
  c.is_profit_loss_account,
  MAX(am.created_at) as last_activity,
  COUNT(am.id) as movements_count
FROM customers c
LEFT JOIN account_movements am ON c.id = am.customer_id
GROUP BY c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at, c.account_number, c.is_profit_loss_account
ORDER BY last_activity DESC NULLS LAST;

-- 5.3 View إحصائيات العملاء
DROP VIEW IF EXISTS customer_statistics CASCADE;
CREATE OR REPLACE VIEW customer_statistics AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.balance,
  COUNT(DISTINCT t.id) as total_transactions,
  COALESCE(SUM(t.amount_sent), 0) as total_sent,
  COALESCE(SUM(d.amount - d.paid_amount), 0) as total_debt
FROM customers c
LEFT JOIN transactions t ON c.id = t.customer_id
LEFT JOIN debts d ON c.id = d.customer_id AND d.status != 'paid'
GROUP BY c.id, c.name, c.phone, c.balance;

-- ============================================
-- القسم 6: إعداد Storage للشعارات
-- ============================================

-- 6.1 إنشاء Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-logos',
  'shop-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 6.2 سياسات Storage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for shop-logos') THEN
    CREATE POLICY "Public Access for shop-logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Upload for anon users on shop-logos') THEN
    CREATE POLICY "Upload for anon users on shop-logos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Update for anon users on shop-logos') THEN
    CREATE POLICY "Update for anon users on shop-logos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'shop-logos')
    WITH CHECK (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Delete for anon users on shop-logos') THEN
    CREATE POLICY "Delete for anon users on shop-logos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'shop-logos');
  END IF;
END $$;

-- ============================================
-- القسم 7: تفعيل RLS وإنشاء السياسات
-- ============================================

-- 7.1 تفعيل RLS على جميع الجداول
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_security ENABLE ROW LEVEL SECURITY;

-- 7.2 سياسات RLS (السماح بجميع العمليات)
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on debts" ON debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on exchange_rates" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on receipts" ON receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on account_movements" ON account_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on deletion_logs" ON deletion_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on app_security" ON app_security FOR ALL USING (true) WITH CHECK (true);

-- 7.3 سياسة حماية حساب Ali
CREATE POLICY "Protect admin user Ali" ON app_security FOR DELETE USING (user_name != 'Ali');

-- ============================================
-- القسم 8: إنشاء البيانات الأولية
-- ============================================

-- 8.1 إنشاء حساب الأرباح والخسائر
DO $$
DECLARE
  v_profit_loss_id uuid;
BEGIN
  SELECT id INTO v_profit_loss_id FROM customers WHERE phone = 'PROFIT_LOSS_ACCOUNT';

  IF v_profit_loss_id IS NULL THEN
    INSERT INTO customers (name, phone, email, address, notes, is_profit_loss_account, account_number)
    VALUES (
      'الأرباح والخسائر',
      'PROFIT_LOSS_ACCOUNT',
      'profit@system.local',
      'حساب نظامي',
      'حساب خاص لتسجيل الأرباح والخسائر من العمولات - لا يجب حذفه',
      true,
      'P&L-ACCOUNT'
    );
  END IF;
END $$;

-- 8.2 إنشاء مستخدم Ali الأدمن (PIN: 11223344)
INSERT INTO app_security (user_name, pin_hash, role, is_active)
SELECT 'Ali', '482c811da5d5b4bc6d497ffa98491e38', 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM app_security WHERE LOWER(user_name) = 'ali');

-- 8.3 إضافة إعدادات التطبيق الافتراضية
INSERT INTO app_settings (shop_name, shop_phone, shop_address)
VALUES ('محل الحوالات المالية', NULL, NULL)
ON CONFLICT DO NOTHING;

-- 8.4 إضافة أسعار صرف أولية
INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES
  ('USD', 'TRY', 34.50, 'manual'),
  ('USD', 'SAR', 3.75, 'manual'),
  ('USD', 'EUR', 0.92, 'manual'),
  ('USD', 'GBP', 0.79, 'manual'),
  ('USD', 'AED', 3.67, 'manual'),
  ('SAR', 'TRY', 9.20, 'manual'),
  ('EUR', 'USD', 1.087, 'manual'),
  ('GBP', 'USD', 1.2658, 'manual'),
  ('TRY', 'USD', 0.029, 'manual'),
  ('AED', 'USD', 0.272, 'manual')
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- ============================================
-- القسم 9: تفعيل Realtime
-- ============================================

DO $$
BEGIN
  -- تفعيل Realtime للجداول المطلوبة
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE account_movements;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_security;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE exchange_rates;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================
-- انتهى الإعداد بنجاح!
-- ============================================

-- التحقق من نجاح الإعداد
DO $$
DECLARE
  v_tables_count int;
  v_functions_count int;
  v_profit_loss_exists boolean;
  v_ali_exists boolean;
BEGIN
  -- عدد الجداول
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('customers', 'transactions', 'debts', 'exchange_rates', 'receipts', 'app_settings', 'account_movements', 'deletion_logs', 'app_security');

  -- عدد الدوال
  SELECT COUNT(*) INTO v_functions_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name IN ('generate_movement_number', 'generate_transaction_number', 'create_internal_transfer', 'reset_customer_account', 'delete_customer_completely');

  -- التحقق من حساب الأرباح والخسائر
  SELECT EXISTS(SELECT 1 FROM customers WHERE phone = 'PROFIT_LOSS_ACCOUNT') INTO v_profit_loss_exists;

  -- التحقق من مستخدم Ali
  SELECT EXISTS(SELECT 1 FROM app_security WHERE LOWER(user_name) = 'ali') INTO v_ali_exists;

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'تم إعداد قاعدة البيانات بنجاح!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'عدد الجداول المُنشأة: %', v_tables_count;
  RAISE NOTICE 'عدد الدوال المُنشأة: %', v_functions_count;
  RAISE NOTICE 'حساب الأرباح والخسائر: %', CASE WHEN v_profit_loss_exists THEN 'موجود ✓' ELSE 'غير موجود ✗' END;
  RAISE NOTICE 'مستخدم Ali الأدمن: %', CASE WHEN v_ali_exists THEN 'موجود ✓' ELSE 'غير موجود ✗' END;
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'معلومات الدخول:';
  RAISE NOTICE 'اسم المستخدم: Ali';
  RAISE NOTICE 'الرقم السري: 11223344';
  RAISE NOTICE '==============================================';
END $$;
