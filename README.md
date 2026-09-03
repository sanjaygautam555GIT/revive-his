# revive-his
Hospital Information System for Revive Hospital

## IPD pharmacy billing setup

Run `supabase/ipd-pharmacy-auto-import.sql` once in Supabase. Each IPD pharmacy sale then creates exactly one linked Pharmacy Charge in `ipd_daily_charges`. The final IPD bill adjusts that charge against the original advance without recording a second cash collection.
