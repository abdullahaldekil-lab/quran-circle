
-- Financial accounts table
CREATE TABLE public.financial_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name text NOT NULL,
  bank_name text,
  iban text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check staff role for finance access
CREATE OR REPLACE FUNCTION public.get_staff_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = _user_id
$$;

-- Only manager and admin_staff can view financial accounts
CREATE POLICY "Finance staff can view accounts"
ON public.financial_accounts FOR SELECT
USING (public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

CREATE POLICY "Manager can manage accounts"
ON public.financial_accounts FOR ALL
USING (public.get_staff_role(auth.uid()) = 'manager')
WITH CHECK (public.get_staff_role(auth.uid()) = 'manager');

-- Transaction categories enum
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Financial transactions table
CREATE TABLE public.financial_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference_number text,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Manager and admin_staff can view transactions
CREATE POLICY "Finance staff can view transactions"
ON public.financial_transactions FOR SELECT
USING (public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

-- Manager and admin_staff can insert transactions
CREATE POLICY "Finance staff can insert transactions"
ON public.financial_transactions FOR INSERT
WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

-- Manager can update transactions (approve, edit)
CREATE POLICY "Manager can update transactions"
ON public.financial_transactions FOR UPDATE
USING (public.get_staff_role(auth.uid()) = 'manager');

-- Manager can delete non-approved transactions
CREATE POLICY "Manager can delete transactions"
ON public.financial_transactions FOR DELETE
USING (public.get_staff_role(auth.uid()) = 'manager' AND status != 'approved');

-- Transaction audit log
CREATE TABLE public.financial_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  performed_by uuid REFERENCES public.profiles(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance staff can view audit log"
ON public.financial_audit_log FOR SELECT
USING (public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

CREATE POLICY "System can insert audit log"
ON public.financial_audit_log FOR INSERT
WITH CHECK (public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

-- Add updated_at triggers
CREATE TRIGGER update_financial_accounts_updated_at
BEFORE UPDATE ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default account
INSERT INTO public.financial_accounts (account_name, status)
VALUES ('الحساب الرسمي لمجمع حويلان', 'active');

-- Create storage bucket for financial attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('financial-attachments', 'financial-attachments', false);

CREATE POLICY "Finance staff can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'financial-attachments' AND public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));

CREATE POLICY "Finance staff can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'financial-attachments' AND public.get_staff_role(auth.uid()) IN ('manager', 'admin_staff'));
