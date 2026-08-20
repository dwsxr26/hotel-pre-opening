-- Florence Pre-Opening — reallocation also cuts the donor line's forecast.
-- Run this in the Supabase SQL editor after 0018_overspend_clear_pending.sql.
--
-- Budgets are spread across the monthly forecast, so reducing a donor line's
-- budget must reduce its forecast too (you can't cut what's already spent). The
-- app spreads each reduction pro-rata across the donor's future open months and
-- passes it in p_reductions as:
--   [{ "line_id": uuid, "amount": number, "adjustments": [{ "month": date, "amount": number }] }]
-- where each adjustment amount is negative. This replaces the 0017 function.

create or replace function public.approve_overspend(
  p_line_id uuid, p_month date, p_method text, p_note text, p_reductions jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  r          record;
  a          record;
  v_total    numeric := 0;
  v_approval uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve an overspend';
  end if;
  if p_method not in ('reallocated', 'accepted') then
    raise exception 'Unknown approval method %', p_method;
  end if;

  select id into v_approval from public.service_overspend_approvals
    where line_id = p_line_id and month = p_month;
  if v_approval is null then
    raise exception 'No overspend request found for this line/month';
  end if;

  if p_method = 'reallocated' then
    for r in select * from jsonb_to_recordset(coalesce(p_reductions, '[]'::jsonb))
             as x(line_id uuid, amount numeric, adjustments jsonb)
    loop
      if r.amount is null or r.amount <= 0 or r.line_id is null then continue; end if;

      insert into public.service_overspend_reductions (approval_id, line_id, amount)
        values (v_approval, r.line_id, r.amount);
      update public.service_lines set budget = budget - r.amount where id = r.line_id;
      v_total := v_total + r.amount;

      -- Cut the donor line's forecast pro-rata (negative forecast entries).
      if r.adjustments is not null then
        for a in select * from jsonb_to_recordset(r.adjustments) as y(month date, amount numeric)
        loop
          if a.amount is null or a.amount = 0 or a.month is null then continue; end if;
          insert into public.service_entries (line_id, month, type, title, amount_ex_vat, vat_pct)
            values (r.line_id, a.month, 'forecast', 'Budget reallocated (overspend approval)', a.amount, 22);
        end loop;
      end if;
    end loop;

    if v_total > 0 then
      update public.service_lines set budget = budget + v_total where id = p_line_id;
    end if;
  end if;

  update public.service_overspend_approvals
    set status = 'approved', method = p_method, note = coalesce(p_note, ''),
        approved_by = auth.uid(), approved_at = now()
    where id = v_approval;
end $$;

grant execute on function public.approve_overspend(uuid, date, text, text, jsonb) to authenticated;
