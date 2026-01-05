-- Create contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    form_schema jsonb DEFAULT '[]',
    html_content text,
    is_system boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can READ all templates
CREATE POLICY "Everyone can read templates" ON contract_templates
    FOR SELECT USING (true);

-- Policy: Authenticated users can INSERT their own templates
CREATE POLICY "Authenticated users can create templates" ON contract_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can UPDATE their own templates
CREATE POLICY "Users can update own templates" ON contract_templates
    FOR UPDATE USING (
        (auth.uid() = created_by) OR 
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    );

-- Policy: Users can DELETE their own templates (Protect System Templates)
CREATE POLICY "Users can delete own non-system templates" ON contract_templates
    FOR DELETE USING (
        (auth.uid() = created_by) AND (is_system = false)
    );
