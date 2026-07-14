
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin','supervisor','caretaker','site_rep');
CREATE TYPE public.checklist_cadence AS ENUM ('daily','weekly','monthly');
CREATE TYPE public.checklist_format AS ENUM ('status_comment','day_grid','fault_log');
CREATE TYPE public.submission_status AS ENUM ('in_progress','submitted');
CREATE TYPE public.entry_status AS ENUM ('done','not_done','na');
CREATE TYPE public.fault_status AS ENUM ('reported','broken','repaired');

-- =========================
-- PROPERTIES
-- =========================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  theme_color TEXT NOT NULL DEFAULT '#0ea5e9',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER PROFILES
-- =========================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  role public.app_role,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- =========================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================
CREATE OR REPLACE FUNCTION public.get_user_role(_uid UUID)
RETURNS public.app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_profiles WHERE id = _uid AND active = true $$;

CREATE OR REPLACE FUNCTION public.get_user_property(_uid UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT property_id FROM public.user_profiles WHERE id = _uid AND active = true $$;

CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = _uid AND role = 'admin' AND active = true) $$;

-- =========================
-- TRIGGER: create profile on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- USER PROFILES RLS
-- =========================
CREATE POLICY "self can view own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admin can view all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin can update any profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin can delete profiles" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================
-- PROPERTIES RLS
-- =========================
CREATE POLICY "assigned users can view their property" ON public.properties
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR id = public.get_user_property(auth.uid()));

CREATE POLICY "admin manages properties" ON public.properties
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- CHECKLIST TEMPLATES
-- =========================
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence public.checklist_cadence NOT NULL,
  format public.checklist_format NOT NULL,
  role_required public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view templates for own property/role" ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      property_id = public.get_user_property(auth.uid())
      AND role_required = public.get_user_role(auth.uid())
    )
  );

CREATE POLICY "admin manages templates" ON public.checklist_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- CHECKLIST CATEGORIES
-- =========================
CREATE TABLE public.checklist_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_categories TO authenticated;
GRANT ALL ON public.checklist_categories TO service_role;
ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view categories via template" ON public.checklist_categories
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.checklist_templates t
      WHERE t.id = template_id
        AND t.property_id = public.get_user_property(auth.uid())
        AND t.role_required = public.get_user_role(auth.uid())
    )
  );

CREATE POLICY "admin manages categories" ON public.checklist_categories
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- CHECKLIST ITEMS
-- =========================
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.checklist_categories(id) ON DELETE CASCADE,
  parent_item_id UUID REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view items via category" ON public.checklist_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.checklist_categories c
      JOIN public.checklist_templates t ON t.id = c.template_id
      WHERE c.id = category_id
        AND t.property_id = public.get_user_property(auth.uid())
        AND t.role_required = public.get_user_role(auth.uid())
    )
  );

CREATE POLICY "admin manages items" ON public.checklist_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- SUBMISSIONS
-- =========================
CREATE TABLE public.checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'in_progress',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_submissions TO authenticated;
GRANT ALL ON public.checklist_submissions TO service_role;
ALTER TABLE public.checklist_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own-property submissions" ON public.checklist_submissions
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      property_id = public.get_user_property(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.checklist_templates t
        WHERE t.id = template_id
          AND t.role_required = public.get_user_role(auth.uid())
      )
    )
  );

CREATE POLICY "insert submissions for own property/role" ON public.checklist_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND property_id = public.get_user_property(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.checklist_templates t
      WHERE t.id = template_id
        AND t.property_id = checklist_submissions.property_id
        AND t.role_required = public.get_user_role(auth.uid())
    )
  );

CREATE POLICY "update own in-progress submissions" ON public.checklist_submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      user_id = auth.uid()
      AND property_id = public.get_user_property(auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (user_id = auth.uid())
  );

CREATE POLICY "admin deletes submissions" ON public.checklist_submissions
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER submissions_touch BEFORE UPDATE ON public.checklist_submissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- ENTRIES (insert-only for non-admin; filled_at server-side)
-- =========================
CREATE TABLE public.checklist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.checklist_submissions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 5)),
  status public.entry_status NOT NULL,
  comment TEXT,
  photo_url TEXT,
  filled_by UUID NOT NULL REFERENCES auth.users(id),
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.checklist_entries TO authenticated;
GRANT ALL ON public.checklist_entries TO service_role;
ALTER TABLE public.checklist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view entries via submission" ON public.checklist_entries
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.checklist_submissions s
      WHERE s.id = submission_id
        AND s.property_id = public.get_user_property(auth.uid())
    )
  );

CREATE POLICY "insert entries into own active submission" ON public.checklist_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    filled_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.checklist_submissions s
      WHERE s.id = submission_id
        AND s.user_id = auth.uid()
        AND s.property_id = public.get_user_property(auth.uid())
    )
  );

-- Prevent updates to entries by non-admin via trigger (belt+braces; RLS also excludes UPDATE)
CREATE OR REPLACE FUNCTION public.entries_lock_filled_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.filled_at = now();
    NEW.filled_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER entries_server_fill BEFORE INSERT ON public.checklist_entries
FOR EACH ROW EXECUTE FUNCTION public.entries_lock_filled_at();

-- Admin update/delete
CREATE POLICY "admin update entries" ON public.checklist_entries
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete entries" ON public.checklist_entries
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- =========================
-- FAULT LOG
-- =========================
CREATE TABLE public.fault_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.checklist_submissions(id) ON DELETE SET NULL,
  equipment_type TEXT NOT NULL,
  fault_description TEXT NOT NULL,
  status public.fault_status NOT NULL DEFAULT 'reported',
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fault_log_entries TO authenticated;
GRANT ALL ON public.fault_log_entries TO service_role;
ALTER TABLE public.fault_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view faults for own property" ON public.fault_log_entries
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR property_id = public.get_user_property(auth.uid())
  );

CREATE POLICY "insert faults on own property" ON public.fault_log_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND property_id = public.get_user_property(auth.uid())
    AND public.get_user_role(auth.uid()) IS NOT NULL
  );

CREATE POLICY "update faults on own property" ON public.fault_log_entries
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR property_id = public.get_user_property(auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR property_id = public.get_user_property(auth.uid())
  );

CREATE POLICY "admin delete faults" ON public.fault_log_entries
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
