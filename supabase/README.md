# Supabase Migrations

Run supabase db pull after linking your project to capture the current schema.
Run supabase db diff after making changes to generate new migration files.

## Commands
- supabase login
- supabase link --project-ref <ref>
- supabase db pull        # pull current schema as migration
- supabase db diff        # diff local vs remote
- supabase migration new  # create blank migration

