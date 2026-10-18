begin;
create or replace function public.personal_api(p_action text,p_body jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); v_id uuid; k uuid; h text; old private.personal_requests; result jsonb; d public.documents; file bytea; n bigint; rate numeric; term integer; due integer; v_period date;
begin
 if u is null then raise exception 'Sign in to My Home';end if;
 if p_action='context' then
 return jsonb_build_object(
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'folder',x.folder,'mime',x.mime,'status',x.scan_state,'created',x.created_at,'archived_at',x.archived_at,'bytes',octet_length(f.content)) order by x.created_at desc) from public.documents x join private.personal_files f on f.document_id=x.id where x.user_id=u),'[]'::jsonb),
 'expenses',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'description',x.description,'category',x.category,'amount',x.amount_paise,'kind',x.kind,'date',x.spent_on,'archived_at',x.archived_at) order by x.spent_on desc,x.id) from public.expenses x where x.user_id=u),'[]'::jsonb),
 'loans',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'principal',x.principal_paise,'rate',x.annual_rate,'months',x.months,'due_day',x.due_day,'archived_at',x.archived_at) order by x.title,x.id) from public.loans x where x.user_id=u),'[]'::jsonb),
 'loanPayments',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'loan_id',x.loan_id,'month',to_char(x.period,'YYYY-MM'),'amount',x.amount_paise,'verification',x.verification) order by x.period desc) from public.loan_payments x where x.user_id=u),'[]'::jsonb));
 end if;
 if p_action='download' then
 select * into d from public.documents where documents.id=(p_body->>'id')::uuid and user_id=u and archived_at is null;
 if not found then raise exception 'Document unavailable';end if;
 select content into file from private.personal_files where document_id=d.id;
 if file is null then raise exception 'Document unavailable';end if;
 return jsonb_build_object('name',d.name,'mime',d.mime,'data',encode(file,'base64'));
 end if;
 k:=(p_body->>'key')::uuid;if k is null then raise exception 'A request key is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,93));
 h:=encode(sha256(convert_to(jsonb_build_array(p_action,p_body-'key')::text,'UTF8')),'hex');
 select * into old from private.personal_requests where user_id=u and key=k;
 if found then if old.hash<>h then raise exception 'This request key was already used for different details';end if;return old.result;end if;
 if (select count(*) from private.personal_requests where user_id=u)>20000 then raise exception 'Personal workspace request limit reached. Contact support';end if;
 if p_action='expense' then
 if (select count(*) from public.expenses where user_id=u)>=2000 then raise exception 'Your ledger has reached 2,000 entries';end if;
 if p_body->>'kind' not in ('income','expense') or p_body->>'kind' is null then raise exception 'Choose income or expense';end if;
 if p_body->>'category' not in ('Groceries','Bills','Travel','Dining','Health','Home','Other') or p_body->>'category' is null then raise exception 'Choose a category';end if;
 if p_body->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or p_body->>'date' is null or to_char((p_body->>'date')::date,'YYYY-MM-DD')<>p_body->>'date' then raise exception 'Choose a valid date';end if;
 if (p_body->>'date')::date < date '1900-01-01' or (p_body->>'date')::date>date '2200-12-31' then raise exception 'Choose a date between 1900 and 2200';end if;
 insert into public.expenses(user_id,description,category,amount_paise,kind,spent_on) values(u,private.op_text(p_body->>'description',120),p_body->>'category',private.op_amount(p_body->>'amount',1,1000000000),p_body->>'kind',(p_body->>'date')::date) returning expenses.id into v_id;
 elsif p_action='loan' then
 if (select count(*) from public.loans where user_id=u)>=200 then raise exception 'Loan limit reached';end if;
 rate:=(p_body->>'rate')::numeric;term:=(p_body->>'months')::integer;due:=(p_body->>'dueDay')::integer;
 if rate is null or rate<0 or rate>100 or rate::text='NaN' or term is null or term not between 1 and 600 or due is null or due not between 1 and 28 or (p_body->>'months')::numeric<>term or (p_body->>'dueDay')::numeric<>due then raise exception 'Check rate, whole months and due day';end if;
 insert into public.loans(user_id,title,principal_paise,annual_rate,months,due_day) values(u,private.op_text(p_body->>'title',80),private.op_amount(p_body->>'principal',100,1000000000000),rate,term,due) returning loans.id into v_id;
 elsif p_action='payment' then
 v_id:=(p_body->>'loanId')::uuid;
 perform 1 from public.loans where loans.id=v_id and user_id=u and archived_at is null for update;
 if not found then raise exception 'Loan unavailable';end if;
 v_period:=private.op_month(p_body->>'month');
 if v_period<date '1900-01-01' or v_period>date_trunc('month',now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose this month or a previous month';end if;
 n:=private.op_amount(p_body->>'amount',1,1000000000000);
 -- One monthly total, intentionally corrected through the same form; never bank verified.
 insert into public.loan_payments(loan_id,user_id,period,amount_paise,verification) values(v_id,u,v_period,n,'user_marked')
 on conflict(loan_id,period) do update set amount_paise=excluded.amount_paise where public.loan_payments.user_id=u returning loan_payments.id into v_id;
 elsif p_action='document' then
 if (select count(*) from public.documents where user_id=u)>=100 then raise exception 'Your vault has reached 100 documents';end if;
 if p_body->>'mime' not in ('application/pdf','image/jpeg') or p_body->>'mime' is null then raise exception 'Unsupported document format';end if;
 if length(p_body->>'data')>2666668 or p_body->>'data' is null then raise exception 'Choose a document below 2 MB';end if;
 file:=decode(p_body->>'data','base64');n:=octet_length(file);
 if n not between 1 and 2000000 then raise exception 'Choose a document below 2 MB';end if;
 if p_body->>'mime'='application/pdf' and substring(file from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'Invalid PDF';end if;
 if p_body->>'mime'='image/jpeg' and substring(file from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'Invalid JPEG';end if;
 if coalesce((select sum(octet_length(f.content)) from private.personal_files f join public.documents x on x.id=f.document_id where x.user_id=u),0)+n>20000000 then raise exception 'Your private vault has reached 20 MB';end if;
 v_id:=gen_random_uuid();
 insert into public.documents(id,user_id,object_key,name,folder,mime,scan_state) values(v_id,u,u::text||'/'||v_id::text,private.op_text(p_body->>'name',120),private.op_text(p_body->>'folder',40),p_body->>'mime','quarantined');
 insert into private.personal_files values(v_id,file);
 elsif p_action in ('archive-document','restore-document','archive-expense','restore-expense','archive-loan','restore-loan') then
 v_id:=(p_body->>'id')::uuid;
 if p_action like '%document' then update public.documents set archived_at=case when p_action like 'archive-%' then now() end where documents.id=v_id and user_id=u;
 elsif p_action like '%expense' then update public.expenses set archived_at=case when p_action like 'archive-%' then now() end where expenses.id=v_id and user_id=u;
 else update public.loans set archived_at=case when p_action like 'archive-%' then now() end where loans.id=v_id and user_id=u;end if;
 if not found then raise exception 'Record unavailable';end if;
 else raise exception 'Unsupported personal action';end if;
 result:=jsonb_build_object('id',v_id,'ok',true);
 insert into private.personal_requests values(u,k,h,result);
 insert into private.audit(actor_id,action,target_id) values(u,'personal.'||p_action,v_id);
 return result;
end;$$;
commit;
