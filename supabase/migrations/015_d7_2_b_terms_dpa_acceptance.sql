-- D7.2.B — record which T&Cs and DPA version the restaurant accepted at signing
alter table public.contracts
  add column if not exists terms_version_accepted text,
  add column if not exists dpa_version_accepted text;

comment on column public.contracts.terms_version_accepted is
  'Version of the algemene voorwaarden the restaurant accepted at signing (e.g. "1.0"). Null means not yet accepted.';
comment on column public.contracts.dpa_version_accepted is
  'Version of the verwerkersovereenkomst the restaurant accepted at signing (e.g. "1.0"). Null means not yet accepted.';
