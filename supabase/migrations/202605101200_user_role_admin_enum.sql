-- Tillad profiles.role = 'admin' (bruges af assertAdminByBearerToken på serveren).
alter type public.user_role add value if not exists 'admin';
