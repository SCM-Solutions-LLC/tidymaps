-- Usefulness and willingness to pay used to share one column: `useful` held
-- "I would pay for this" as a fourth option on what was framed as a scale of
-- how useful the plan was. They are two questions now (js/data.js FB_USEFUL,
-- FB_PAY), so they need two columns; existing rows keep whatever they wrote
-- into `useful` under the old four-option scale.
alter table public.feedback add column pay text;
