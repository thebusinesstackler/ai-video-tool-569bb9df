CREATE OR REPLACE FUNCTION public.introspect_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'database_tables', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', t.table_name,
          'columns', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', c.column_name,
                'type', c.data_type,
                'nullable', c.is_nullable = 'YES',
                'default', c.column_default
              )
            )
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = t.table_name
          )
        )
      )
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ),
    'rls_policies', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'name', policyname,
          'command', cmd,
          'permissive', permissive = 'PERMISSIVE'
        )
      )
      FROM pg_policies
      WHERE schemaname = 'public'
    ),
    'functions', (
      SELECT jsonb_agg(routine_name)
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    ),
    'timestamp', to_jsonb(now())
  ) INTO result;
  RETURN result;
END;
$$;