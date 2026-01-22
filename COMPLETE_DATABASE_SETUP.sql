/*
  ============================================
  نظام إدارة الحوالات المالية - الإعداد الكامل
  ============================================

  هذا الملف يحتوي على جميع الأوامر اللازمة لإعداد قاعدة البيانات من الصفر

  التعليمات:
  1. افتح SQL Editor في Supabase Dashboard
  2. انسخ المحتوى بالكامل
  3. الصق في SQL Editor
  4. اضغط Run
  5. انتظر حتى تكتمل جميع العمليات

  ملاحظات هامة:
  - المستخدم الافتراضي: Ali
  - الرقم السري الافتراضي: 11223344
  - حساب الأرباح والخسائر يتم إنشاؤه تلقائياً
  - جميع الجداول محمية بـ RLS

  ============================================
*/

-- ============================================
-- القسم 1: إنشاء الجداول الأساسية
-- ============================================

-- 1.1 جدول العملاء
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  balance decimal(15, 2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  account_number text UNIQUE,
  is_profit_loss_account boolean DEFAULT false
);

COMMENT ON TABLE customers IS 'جدول العملاء - يحتوي على معلومات جميع العملاء والحسابات';
COMMENT ON COLUMN customers.is_profit_loss_account IS 'يحدد إذا كان هذا الحساب هو حساب الأرباح والخسائر. يجب أن يكون حساب واحد فقط في النظام.';

-- 1.2 جدول الحوالات
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  amount_sent decimal(15, 2) NOT NULL,
  currency_sent text NOT NULL,
  amount_received decimal(15, 2) NOT NULL,
  currency_received text NOT NULL,
  exchange_rate decimal(15, 6) NOT NULL,
  status text DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 1.3 جدول الديون
CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  amount decimal(15, 2) NOT NULL,
  currency text NOT NULL,
  reason text,
  status text DEFAULT 'pending',
  paid_amount decimal(15, 2) DEFAULT 0,
  due_date date,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- 1.4 جدول أسعار الصرف
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate decimal(15, 6) NOT NULL,
  source text DEFAULT 'api',
  created_at timestamptz DEFAULT now()
);

-- فهرس فريد لأزواج العملات
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_currencies_idx
  ON exchange_rates(from_currency, to_currency);

-- 1.5 جدول السندات
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- 1.6 جدول إعدادات التطبيق
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text DEFAULT 'محل الحوالات المالية',
  shop_logo text,
  shop_phone text,
  shop_address text,
  updated_at timestamptz DEFAULT now(),
  selected_receipt_logo text,
  whatsapp_account_statement_template text DEFAULT 'مرحباً {customer_name}،
رقم الحساب: {account_number}
التاريخ: {date}

{balance}',
  whatsapp_transaction_template text DEFAULT 'مرحباً {customer_name}،

سند الحوالة رقم: {transaction_number}

المبلغ المرسل: {amount_sent} {currency_sent}
المبلغ المستلم: {amount_received} {currency_received}

شكراً لثقتكم بنا
{shop_name}',
  whatsapp_share_account_template text
);

COMMENT ON COLUMN app_settings.selected_receipt_logo IS 'رابط الشعار الذي يظهر في جميع السندات. NULL = استخدام shop_logo';

-- 1.7 جدول حركات الحسابات
CREATE TABLE IF NOT EXISTS account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('incoming', 'outgoing')),
  amount decimal(15, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz DEFAULT now(),

  -- حقول السند
  receipt_number text UNIQUE,
  receipt_generated_at timestamptz,

  -- حقول المرسل والمستفيد
  sender_name text DEFAULT 'علي هادي علي الرازحي',
  beneficiary_name text,

  -- حقول التحويل الداخلي
  transfer_number text UNIQUE,
  from_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  to_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  transfer_direction text CHECK (transfer_direction IN ('shop_to_customer', 'customer_to_shop', 'customer_to_customer')),
  related_transfer_id uuid REFERENCES account_movements(id) ON DELETE SET NULL,
  transfer_group_id uuid,
  is_internal_transfer boolean DEFAULT false,

  -- حقول العمولة
  commission decimal(15, 2),
  commission_currency text DEFAULT 'USD',
  commission_recipient_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  is_commission_movement boolean DEFAULT false,
  related_commission_movement_id uuid REFERENCES account_movements(id) ON DELETE SET NULL
);

COMMENT ON TABLE account_movements IS 'جدول حركات الحسابات - يدعم التحويلات الداخلية والعمولات';
COMMENT ON COLUMN account_movements.commission_recipient_id IS 'معرف العميل الذي يستلم العمولة (NULL = الأرباح والخسائر)';
COMMENT ON COLUMN account_movements.is_commission_movement IS 'يحدد ما إذا كانت هذه الحركة عبارة عن حركة عمولة منفصلة (true) أو حركة عادية (false)';
COMMENT ON COLUMN account_movements.related_commission_movement_id IS 'معرف الحركة الأساسية التي تسببت في هذه العمولة (للربط بين الحركة الأساسية وحركة العمولة)';

-- 1.8 جدول سجل الحذف
CREATE TABLE IF NOT EXISTS deletion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type IN ('reset_account', 'delete_customer', 'delete_movement', 'delete_user')),
  customer_id uuid,
  customer_name text,
  customer_account_number text,
  movements_count int DEFAULT 0,
  deleted_at timestamptz DEFAULT now(),
  notes text
);

-- 1.9 جدول الأمان
CREATE TABLE IF NOT EXISTS app_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  pin_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- ============================================
-- القسم 2: إنشاء الفهارس للأداء
-- ============================================

-- فهارس جدول account_movements
CREATE INDEX IF NOT EXISTS account_movements_customer_id_idx ON account_movements(customer_id);
CREATE INDEX IF NOT EXISTS account_movements_created_at_idx ON account_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS account_movements_type_idx ON account_movements(movement_type);
CREATE INDEX IF NOT EXISTS account_movements_from_customer_idx ON account_movements(from_customer_id);
CREATE INDEX IF NOT EXISTS account_movements_to_customer_idx ON account_movements(to_customer_id);
CREATE INDEX IF NOT EXISTS account_movements_commission_movement_idx ON account_movements(is_commission_movement);

-- فهارس جدول deletion_logs
CREATE INDEX IF NOT EXISTS deletion_logs_customer_id_idx ON deletion_logs(customer_id);
CREATE INDEX IF NOT EXISTS deletion_logs_deleted_at_idx ON deletion_logs(deleted_at DESC);
CREATE INDEX IF NOT EXISTS deletion_logs_operation_type_idx ON deletion_logs(operation_type);

-- ============================================
-- القسم 3: إنشاء الدوال الأساسية
-- ============================================

-- 3.1 دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 دالة توليد رقم حركة تلقائي
CREATE OR REPLACE FUNCTION generate_movement_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter int;
  random_suffix text;
BEGIN
  SELECT COUNT(*) INTO counter FROM account_movements WHERE DATE(created_at) = CURRENT_DATE;

  LOOP
    counter := counter + 1;
    random_suffix := LPAD((FLOOR(RANDOM() * 1000))::text, 3, '0');
    new_number := 'MOV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0') || '-' || random_suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM account_movements WHERE movement_number = new_number);
  END LOOP;

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 3.3 دالة توليد رقم حوالة تلقائي
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter int;
BEGIN
  SELECT COUNT(*) INTO counter FROM transactions WHERE created_at::date = CURRENT_DATE;
  new_number := 'TXN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::text, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 3.4 دالة إنشاء تحويل داخلي
CREATE OR REPLACE FUNCTION create_internal_transfer(
  p_from_customer_id uuid,
  p_to_customer_id uuid,
  p_amount decimal,
  p_currency text,
  p_notes text DEFAULT NULL,
  p_commission decimal DEFAULT NULL,
  p_commission_currency text DEFAULT 'USD',
  p_commission_recipient_id uuid DEFAULT NULL
)
RETURNS TABLE (
  from_movement_id uuid,
  to_movement_id uuid,
  success boolean,
  message text
) AS $$
DECLARE
  v_from_movement_id uuid;
  v_to_movement_id uuid;
  v_from_movement_number text;
  v_to_movement_number text;
  v_transfer_direction text;
  v_from_customer_name text;
  v_to_customer_name text;
  v_actual_to_amount decimal;
  v_actual_from_amount decimal;
BEGIN
  -- التحقق من صحة المدخلات
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'المبلغ يجب أن يكون أكبر من صفر'::text;
    RETURN;
  END IF;

  IF p_commission IS NOT NULL AND p_commission < 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'العمولة يجب أن تكون صفر أو أكبر'::text;
    RETURN;
  END IF;

  IF p_from_customer_id IS NOT NULL AND p_to_customer_id IS NOT NULL AND p_from_customer_id = p_to_customer_id THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'لا يمكن التحويل لنفس العميل'::text;
    RETURN;
  END IF;

  IF p_commission_recipient_id IS NOT NULL THEN
    IF p_commission_recipient_id != p_from_customer_id AND p_commission_recipient_id != p_to_customer_id THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'مستلم العمولة يجب أن يكون أحد أطراف التحويل'::text;
      RETURN;
    END IF;
  END IF;

  -- تحديد اتجاه التحويل
  IF p_from_customer_id IS NULL AND p_to_customer_id IS NOT NULL THEN
    v_transfer_direction := 'shop_to_customer';
  ELSIF p_from_customer_id IS NOT NULL AND p_to_customer_id IS NULL THEN
    v_transfer_direction := 'customer_to_shop';
  ELSIF p_from_customer_id IS NOT NULL AND p_to_customer_id IS NOT NULL THEN
    v_transfer_direction := 'customer_to_customer';
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'يجب تحديد طرف واحد على الأقل'::text;
    RETURN;
  END IF;

  -- الحصول على أسماء العملاء
  IF p_from_customer_id IS NOT NULL THEN
    SELECT name INTO v_from_customer_name FROM customers WHERE id = p_from_customer_id;
    IF v_from_customer_name IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'العميل المُحوِّل غير موجود'::text;
      RETURN;
    END IF;
  ELSE
    v_from_customer_name := 'المحل';
  END IF;

  IF p_to_customer_id IS NOT NULL THEN
    SELECT name INTO v_to_customer_name FROM customers WHERE id = p_to_customer_id;
    IF v_to_customer_name IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'العميل المُحوَّل إليه غير موجود'::text;
      RETURN;
    END IF;
  ELSE
    v_to_customer_name := 'المحل';
  END IF;

  -- حساب المبالغ الفعلية
  IF p_commission IS NOT NULL AND p_commission > 0 THEN
    IF p_commission_recipient_id = p_from_customer_id THEN
      v_actual_from_amount := p_amount - p_commission;
    ELSE
      v_actual_from_amount := p_amount;
    END IF;

    IF p_commission_recipient_id IS NULL THEN
      v_actual_to_amount := p_amount - p_commission;
    ELSIF p_commission_recipient_id = p_to_customer_id THEN
      v_actual_to_amount := p_amount + p_commission;
    ELSE
      v_actual_to_amount := p_amount;
    END IF;
  ELSE
    v_actual_from_amount := p_amount;
    v_actual_to_amount := p_amount;
  END IF;

  -- إنشاء الحركات
  BEGIN
    IF v_transfer_direction = 'shop_to_customer' THEN
      v_to_movement_number := generate_movement_number();

      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        from_customer_id, to_customer_id, transfer_direction,
        sender_name, beneficiary_name, commission, commission_currency, commission_recipient_id
      ) VALUES (
        v_to_movement_number, p_to_customer_id, 'incoming', v_actual_to_amount, p_currency,
        COALESCE(p_notes, 'تحويل من ' || v_from_customer_name || ' إلى ' || v_to_customer_name),
        NULL, p_to_customer_id, v_transfer_direction,
        v_from_customer_name, v_to_customer_name, p_commission,
        CASE WHEN p_commission IS NOT NULL THEN p_commission_currency ELSE NULL END,
        p_commission_recipient_id
      ) RETURNING id INTO v_to_movement_id;

      RETURN QUERY SELECT NULL::uuid, v_to_movement_id, true, 'تم التحويل بنجاح من المحل إلى ' || v_to_customer_name::text;
      RETURN;

    ELSIF v_transfer_direction = 'customer_to_shop' THEN
      v_from_movement_number := generate_movement_number();

      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        from_customer_id, to_customer_id, transfer_direction,
        sender_name, beneficiary_name, commission, commission_currency, commission_recipient_id
      ) VALUES (
        v_from_movement_number, p_from_customer_id, 'outgoing', v_actual_from_amount, p_currency,
        COALESCE(p_notes, 'تحويل من ' || v_from_customer_name || ' إلى ' || v_to_customer_name),
        p_from_customer_id, NULL, v_transfer_direction,
        v_from_customer_name, v_to_customer_name, p_commission,
        CASE WHEN p_commission IS NOT NULL THEN p_commission_currency ELSE NULL END,
        p_commission_recipient_id
      ) RETURNING id INTO v_from_movement_id;

      RETURN QUERY SELECT v_from_movement_id, NULL::uuid, true, 'تم التحويل بنجاح من ' || v_from_customer_name || ' إلى المحل'::text;
      RETURN;

    ELSIF v_transfer_direction = 'customer_to_customer' THEN
      v_from_movement_number := generate_movement_number();
      v_to_movement_number := generate_movement_number();

      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        from_customer_id, to_customer_id, transfer_direction,
        sender_name, beneficiary_name, commission, commission_currency, commission_recipient_id
      ) VALUES (
        v_from_movement_number, p_from_customer_id, 'outgoing', v_actual_from_amount, p_currency,
        COALESCE(p_notes, 'تحويل من ' || v_from_customer_name || ' إلى ' || v_to_customer_name),
        p_from_customer_id, p_to_customer_id, v_transfer_direction,
        v_from_customer_name, v_to_customer_name, p_commission,
        CASE WHEN p_commission IS NOT NULL THEN p_commission_currency ELSE NULL END,
        p_commission_recipient_id
      ) RETURNING id INTO v_from_movement_id;

      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        from_customer_id, to_customer_id, transfer_direction, related_transfer_id,
        sender_name, beneficiary_name, commission, commission_currency, commission_recipient_id
      ) VALUES (
        v_to_movement_number, p_to_customer_id, 'incoming', v_actual_to_amount, p_currency,
        COALESCE(p_notes, 'تحويل من ' || v_from_customer_name || ' إلى ' || v_to_customer_name),
        p_from_customer_id, p_to_customer_id, v_transfer_direction, v_from_movement_id,
        v_from_customer_name, v_to_customer_name, p_commission,
        CASE WHEN p_commission IS NOT NULL THEN p_commission_currency ELSE NULL END,
        p_commission_recipient_id
      ) RETURNING id INTO v_to_movement_id;

      UPDATE account_movements
      SET related_transfer_id = v_to_movement_id
      WHERE id = v_from_movement_id;

      RETURN QUERY SELECT v_from_movement_id, v_to_movement_id, true, 'تم التحويل بنجاح من ' || v_from_customer_name || ' إلى ' || v_to_customer_name::text;
      RETURN;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'خطأ في إنشاء التحويل: ' || SQLERRM::text;
      RETURN;
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_internal_transfer IS 'إنشاء تحويل داخلي - عند commission_recipient_id=from: المُحوِّل outgoing=(amount-commission)، عند commission_recipient_id=to: المستلم incoming=(amount+commission)';

-- 3.5 دالة تصفير حساب عميل
CREATE OR REPLACE FUNCTION reset_customer_account(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_name text;
  v_account_number text;
  v_movements_count int;
  v_result json;
BEGIN
  SELECT name, account_number INTO v_customer_name, v_account_number
  FROM customers WHERE id = p_customer_id;

  IF v_customer_name IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'العميل غير موجود');
  END IF;

  SELECT COUNT(*) INTO v_movements_count FROM account_movements WHERE customer_id = p_customer_id;

  DELETE FROM account_movements WHERE customer_id = p_customer_id;
  UPDATE customers SET balance = 0 WHERE id = p_customer_id;

  INSERT INTO deletion_logs (operation_type, customer_id, customer_name, customer_account_number, movements_count, notes)
  VALUES ('reset_account', p_customer_id, v_customer_name, v_account_number, v_movements_count, 'تم تصفير حساب العميل وحذف جميع حركاته');

  RETURN json_build_object('success', true, 'message', 'تم تصفير الحساب بنجاح', 'movements_deleted', v_movements_count, 'customer_name', v_customer_name);
END;
$$;

-- 3.6 دالة حذف عميل بالكامل
CREATE OR REPLACE FUNCTION delete_customer_completely(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_name text;
  v_account_number text;
  v_movements_count int;
  v_result json;
BEGIN
  SELECT name, account_number INTO v_customer_name, v_account_number
  FROM customers WHERE id = p_customer_id;

  IF v_customer_name IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'العميل غير موجود');
  END IF;

  SELECT COUNT(*) INTO v_movements_count FROM account_movements WHERE customer_id = p_customer_id;

  INSERT INTO deletion_logs (operation_type, customer_id, customer_name, customer_account_number, movements_count, notes)
  VALUES ('delete_customer', p_customer_id, v_customer_name, v_account_number, v_movements_count, 'تم حذف العميل بالكامل مع جميع حركاته');

  DELETE FROM customers WHERE id = p_customer_id;

  RETURN json_build_object('success', true, 'message', 'تم حذف العميل بنجاح', 'movements_deleted', v_movements_count, 'customer_name', v_customer_name);
END;
$$;

-- 3.7 دالة حذف مستخدم
CREATE OR REPLACE FUNCTION delete_user_by_id(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_name text;
  v_role text;
  v_result json;
BEGIN
  SELECT user_name, role INTO v_user_name, v_role FROM app_security WHERE id = p_user_id;

  IF v_user_name IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'المستخدم غير موجود');
  END IF;

  IF LOWER(v_user_name) = 'ali' THEN
    RETURN json_build_object('success', false, 'message', 'لا يمكن حذف حساب Ali - هذا هو الحساب الرئيسي');
  END IF;

  INSERT INTO deletion_logs (operation_type, customer_id, customer_name, notes)
  VALUES ('delete_user', p_user_id, v_user_name, 'تم حذف مستخدم من نظام الأمان');

  DELETE FROM app_security WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'تم حذف المستخدم بنجاح', 'user_name', v_user_name);
END;
$$;

-- 3.8 دوال حماية حساب Ali
CREATE OR REPLACE FUNCTION prevent_ali_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(OLD.user_name) = 'ali' THEN
    RAISE EXCEPTION 'لا يمكن حذف حساب Ali - هذا هو الحساب الرئيسي';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_at_least_one_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' AND LOWER(OLD.user_name) = 'ali' THEN
    RAISE EXCEPTION 'لا يمكن حذف حساب Ali - هذا هو الحساب الرئيسي';
  END IF;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.role != 'admin' AND OLD.role = 'admin') THEN
    SELECT COUNT(*) INTO admin_count
    FROM app_security
    WHERE role = 'admin' AND is_active = true
      AND (TG_OP = 'DELETE' AND id != OLD.id OR TG_OP = 'UPDATE');

    IF admin_count < 1 THEN
      RAISE EXCEPTION 'لا يمكن حذف آخر مدير في النظام';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- القسم 4: إنشاء الـ Triggers
-- ============================================

-- 4.1 Trigger لتحديث updated_at للعملاء
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4.2 Trigger لتحديث updated_at للإعدادات
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4.3 Trigger لتسجيل العمولات تلقائياً
CREATE OR REPLACE FUNCTION record_commission_to_profit_loss()
RETURNS TRIGGER AS $$
DECLARE
  v_profit_loss_id uuid;
  v_commission_movement_id uuid;
  v_recipient_movement_id uuid;
BEGIN
  IF NEW.commission IS NOT NULL AND NEW.commission > 0 THEN
    SELECT id INTO v_profit_loss_id FROM customers WHERE phone = 'PROFIT_LOSS_ACCOUNT';

    IF v_profit_loss_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.commission_recipient_id IS NOT NULL THEN
      IF NEW.commission_recipient_id != NEW.to_customer_id THEN
        INSERT INTO account_movements (
          movement_number, customer_id, movement_type, amount, currency, notes,
          is_commission_movement, related_commission_movement_id
        ) VALUES (
          generate_movement_number(),
          NEW.commission_recipient_id,
          'incoming',
          NEW.commission,
          NEW.commission_currency,
          'عمولة من حركة ' || NEW.movement_number,
          true,
          NEW.id
        ) RETURNING id INTO v_recipient_movement_id;
      END IF;

      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        is_commission_movement, related_commission_movement_id
      ) VALUES (
        generate_movement_number(),
        v_profit_loss_id,
        'outgoing',
        NEW.commission,
        NEW.commission_currency,
        'دفع عمولة للحركة ' || NEW.movement_number,
        true,
        NEW.id
      ) RETURNING id INTO v_commission_movement_id;
    ELSE
      INSERT INTO account_movements (
        movement_number, customer_id, movement_type, amount, currency, notes,
        is_commission_movement, related_commission_movement_id
      ) VALUES (
        generate_movement_number(),
        v_profit_loss_id,
        'incoming',
        NEW.commission,
        NEW.commission_currency,
        'عمولة من حركة ' || NEW.movement_number,
        true,
        NEW.id
      ) RETURNING id INTO v_commission_movement_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_commission ON account_movements;
CREATE TRIGGER trigger_record_commission
  AFTER INSERT ON account_movements
  FOR EACH ROW
  EXECUTE FUNCTION record_commission_to_profit_loss();

-- 4.4 Triggers لحماية حساب Ali
DROP TRIGGER IF EXISTS prevent_ali_deletion_trigger ON app_security;
CREATE TRIGGER prevent_ali_deletion_trigger
  BEFORE DELETE ON app_security
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ali_deletion();

DROP TRIGGER IF EXISTS ensure_at_least_one_admin_trigger ON app_security;
CREATE TRIGGER ensure_at_least_one_admin_trigger
  BEFORE DELETE OR UPDATE ON app_security
  FOR EACH ROW
  EXECUTE FUNCTION ensure_at_least_one_admin();

-- ============================================
-- القسم 5: إنشاء الـ Views
-- ============================================

-- 5.1 View أرصدة العملاء حسب العملة
DROP VIEW IF EXISTS customer_balances_by_currency CASCADE;
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
