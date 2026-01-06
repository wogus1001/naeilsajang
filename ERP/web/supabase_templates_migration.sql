-- Create contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    form_schema jsonb DEFAULT '[]',
    html_content text,
    is_system boolean DEFAULT false,
    company_id uuid REFERENCES companies(id), -- Company Sharing
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Read Sharing (System OR Own Company)
CREATE POLICY "Enable read access for all users" ON contract_templates
    FOR SELECT USING (
        (is_system = true) OR 
        (created_by = auth.uid()) OR
        (company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        ))
    );

-- Policy: Insert (Authenticated users, requires valid company_id typically handled by API)
CREATE POLICY "Authenticated users can create templates" ON contract_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Update (Author OR Company Admin)
CREATE POLICY "Users can update own or company templates" ON contract_templates
    FOR UPDATE USING (
        (auth.uid() = created_by) OR 
        (EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND company_id = contract_templates.company_id 
            AND role = 'admin'
        ))
    );

-- Policy: Delete (Author OR Company Admin, Protect System Templates)
CREATE POLICY "Users can delete own or company templates" ON contract_templates
    FOR DELETE USING (
        (is_system = false) AND (
            (auth.uid() = created_by) OR 
            (EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND company_id = contract_templates.company_id 
                AND role = 'admin'
            ))
        )
    );

-- --- PROJECT SHARING (CLOUD PROJECTS) ---
-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY, -- Use generated UUID or provided ID
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    category TEXT,
    participants TEXT,
    data JSONB DEFAULT '{}'::JSONB, -- Stores content like documents, commonData
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. RLS Policies for Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT (Read)
CREATE POLICY "Users can view projects of their company" ON public.projects
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        created_by = auth.uid()
    );

-- Policy: INSERT (Create)
CREATE POLICY "Users can create projects" ON public.projects
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

-- Policy: UPDATE
CREATE POLICY "Users can update projects of their company" ON public.projects
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        created_by = auth.uid()
    );

-- Policy: DELETE
CREATE POLICY "Users can delete projects of their company" ON public.projects
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        created_by = auth.uid()
    );

