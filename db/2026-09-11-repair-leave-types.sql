-- Repair for a partial/older OMS Pro schema.
-- Use this only when public.companies already exists but public.leave_types is missing.

DO $$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'public.companies is missing. Run the complete db/schema.sql first.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.leave_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id),
  name                text NOT NULL,
  code                text,
  paid                boolean NOT NULL DEFAULT true,
  annual_accrual_days numeric(5,1) NOT NULL DEFAULT 0,
  accrual_frequency   text NOT NULL DEFAULT 'Monthly'
                      CHECK (accrual_frequency IN ('Monthly', 'Upfront')),
  carry_forward_cap   numeric(5,1),
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type_id uuid REFERENCES public.leave_types(id);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS leave_type_id uuid REFERENCES public.leave_types(id),
  ADD COLUMN IF NOT EXISTS leave_unpaid boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.leave_balance_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           uuid NOT NULL REFERENCES public.employees(id),
  leave_type_id         uuid NOT NULL REFERENCES public.leave_types(id),
  leave_year            int NOT NULL,
  adjustment_days       numeric(5,1) NOT NULL,
  reason                text,
  entered_by_employee_id uuid REFERENCES public.employees(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_adjustments_employee
  ON public.leave_balance_adjustments(employee_id, leave_type_id, leave_year);
