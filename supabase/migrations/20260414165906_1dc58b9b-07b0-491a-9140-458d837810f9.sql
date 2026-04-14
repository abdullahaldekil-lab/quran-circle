-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Manager can delete transactions" ON public.financial_transactions;

-- Create new policy allowing manager to delete any transaction
CREATE POLICY "Manager can delete transactions"
ON public.financial_transactions
FOR DELETE
TO authenticated
USING (get_staff_role(auth.uid()) = 'manager'::text);