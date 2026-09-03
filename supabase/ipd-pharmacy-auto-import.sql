-- Revive HealthScope: automatically link IPD pharmacy sales to IPD daily charges.
-- Safe to run more than once in the Supabase SQL Editor.

create unique index if not exists ipd_daily_charges_pharmacy_bill_unique
on public.ipd_daily_charges (admission_id, description)
where category = 'Pharmacy Charge' and description like 'Pharmacy Bill PH-%';

create or replace function public.import_ipd_pharmacy_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
  v_admission_id text;
  v_uhid text;
begin
  if upper(coalesce(new.patient_type,'')) <> 'IPD' then return new; end if;

  select value into v_meta
  from jsonb_array_elements(coalesce(nullif(new.items_json,''),'[]')::jsonb)
  where coalesce((value->>'__bill_meta')::boolean,false) = true
  limit 1;

  v_admission_id := nullif(trim(v_meta->>'reference'),'');
  v_uhid := nullif(trim(v_meta->>'uhid'),'');
  if v_admission_id is null then raise exception 'IPD pharmacy bill requires an admission reference'; end if;

  insert into public.ipd_daily_charges(
    admission_id,uhid,patient_name,charge_date,category,description,rate,quantity,amount,created_at
  ) values (
    v_admission_id,v_uhid,new.patient_name,coalesce(new.bill_date,current_date),'Pharmacy Charge',
    'Pharmacy Bill PH-' || new.id,coalesce(new.bill_amount,0),1,coalesce(new.bill_amount,0),now()
  ) on conflict (admission_id, description)
    where category = 'Pharmacy Charge' and description like 'Pharmacy Bill PH-%'
    do nothing;

  return new;
end;
$$;

drop trigger if exists pharmacy_sale_to_ipd_daily_charge on public.pharmacy_sales;
create trigger pharmacy_sale_to_ipd_daily_charge
after insert or update of bill_amount,patient_type,items_json on public.pharmacy_sales
for each row execute function public.import_ipd_pharmacy_sale();
