export type ContractLocale = 'nl' | 'en';

export interface OneTimeFeeLine {
  label_nl: string;
  label_en: string;
  amount_ex_vat_eur: number;
  amount_incl_vat_eur: number;
}

export interface ContractContext {
  contract_version: string;
  restaurant_legal_name: string;
  restaurant_kvk: string;
  restaurant_btw_or_dash: string;
  restaurant_address: string;
  services_nl: string;
  services_en: string;
  tier_name: string;
  tier_monthly_ex_vat: string;  // "97,00" (NL comma-decimal, used in both templates)
  tier_monthly_incl_vat: string;
  onetime_fees_breakdown_nl: string;
  onetime_fees_breakdown_en: string;
  onetime_total_ex_vat: string;
  onetime_total_incl_vat: string;
  trial_end_date_nl: string;   // "2 september 2026"
  trial_end_date_en: string;   // "2 September 2026"
  first_billing_date_nl: string;
  first_billing_date_en: string;
  effective_date_placeholder: string;
  signed_ip_placeholder: string;
  signed_user_agent_placeholder: string;
  document_hash_placeholder: string;
  terms_version: string;
  dpa_version: string;
}

export interface RenderedContract {
  locale: ContractLocale;
  markdown: string;
  hash: string;  // sha256 hex
}
