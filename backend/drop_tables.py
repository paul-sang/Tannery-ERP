import psycopg2
try:
    conn = psycopg2.connect("dbname=erp_tannery user=erp_user password=erp_password host=127.0.0.1")
    conn.autocommit = True
    print("Connected.")
    cur = conn.cursor()
    cur.execute("""
    DO $$ DECLARE
        r RECORD;
    BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
    """)
    print("Dropped tables.")
except Exception as e:
    print(f"Error: {e}")
