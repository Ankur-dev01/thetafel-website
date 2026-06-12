-- D7.2 — strengthen contract evidence trail
-- Adds: locale_signed (which version was on screen at sign time),
--       document_hash (SHA-256 of the rendered contract text),
--       authority_confirmed (the authority checkbox state at signing).

alter table public.contracts
  add column if not exists locale_signed text not null default 'nl'
    check (locale_signed in ('nl', 'en')),
  add column if not exists document_hash text,
  add column if not exists authority_confirmed boolean not null default false;

comment on column public.contracts.locale_signed is
  'Locale of the contract text the restaurant signed (nl or en).';
comment on column public.contracts.document_hash is
  'SHA-256 hex of the rendered contract markdown bytes presented to the signer.';
comment on column public.contracts.authority_confirmed is
  'True if the signer confirmed authority to bind the restaurant.';
