-- Exécuter avant de déployer le code qui lit booking_page_mode.
-- Retour arrière : restaurer le code précédent avant de supprimer la colonne.
-- Le rollback du code seul peut conserver la colonne et les choix enregistrés.
-- Tous les comptes commencent avec la page par défaut, quelle que soit leur ancienneté.
-- Une réexécution conserve les choix explicitement enregistrés.
begin;
alter table public.washers add column if not exists booking_page_mode text;
update public.washers set booking_page_mode = 'default' where booking_page_mode is null;
alter table public.washers alter column booking_page_mode set default 'default';
alter table public.washers alter column booking_page_mode set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'washers_booking_page_mode_check' and conrelid = 'public.washers'::regclass) then
    alter table public.washers add constraint washers_booking_page_mode_check check (booking_page_mode in ('default', 'custom'));
  end if;
end $$;
commit;
