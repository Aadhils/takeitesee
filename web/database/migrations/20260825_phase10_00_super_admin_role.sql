-- Phase 10 bootstrap: add the Super Admin role in its own migration transaction.
alter type platform_role add value if not exists 'super_admin';
