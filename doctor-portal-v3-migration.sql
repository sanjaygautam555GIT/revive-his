alter table public.doctor_discharge_summaries add column if not exists surgery_date date;
alter table public.doctor_discharge_summaries add column if not exists ot_category text check (ot_category in ('Major','Minor'));
alter table public.doctor_discharge_summaries add column if not exists complications text;
alter table public.doctor_discharge_summaries add column if not exists discharge_date date;
