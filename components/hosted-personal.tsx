"use client";
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,ArrowRight,Plus,X,Package,Wallet,IndianRupee,FileText,Trash2,LockKeyhole,FolderLock,Download,RefreshCw,Upload,Search} from 'lucide-react';
import {personalExpensesCsv} from '@/lib/personal-csv';
import {amortize} from '@/lib/finance';
import './hosted-personal.css';
type R=Record<string,any>;
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
const day=(s:string)=>new Date(s.length===10?s+'T12:00:00+05:30':s).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const cx=(...c:(string|false|undefined)[])=>c.filter(Boolean).join(' ');
const pending=new Map<string,string>();
async function api(path:string,method='GET',body?:any){
 if(method==='DELETE'){body={id:path.split('/')[1]};path='archive-expense';method='POST';}
 path=({'expenses':'expense','loans':'loan','loan-payment':'payment'} as R)[path]||path;
 let hash='';
 if(method==='POST'&&path!=='emi'){
  hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path+JSON.stringify(body))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  let saved:string|null=null;try{saved=sessionStorage.getItem('md-one-personal-'+hash);}catch{}
  const key=pending.get(hash)||(saved&&/^[0-9a-f-]{36}$/i.test(saved)?saved:null)||crypto.randomUUID();pending.set(hash,key);try{sessionStorage.setItem('md-one-personal-'+hash,key);}catch{}body={...body,key};
 }
 const r=await fetch('/api/personal'+(path?'/'+path:''),{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const d=await r.json();if(!r.ok){if(r.status<500&&hash){pending.delete(hash);try{sessionStorage.removeItem('md-one-personal-'+hash);}catch{}}throw new Error(d.error||'Please try again.');}if(hash){pending.delete(hash);try{sessionStorage.removeItem('md-one-personal-'+hash);}catch{}}return d;
}
function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  return (
    <button
      className={cx("button", variant)}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = Package,
  title,
  description,
}: {
  icon?: typeof Package;
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function SectionTitle({
  eyebrow,
  title,
  action,
  onClick,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-link" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", f);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Package;
}) {
  return (
    <div className="panel metric">
      <span className="document-icon">
        <Icon size={20} />
      </span>
      <small>{title}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Finance({ data, act, busy, view }: any) {
  const [addLoan, setAddLoan] = useState(false),
    [calc, setCalc] = useState<R | null>(null);
  const spent = data.expenses
      .filter(
        (e: R) =>
          e.kind === "expense" &&
          e.date.slice(0, 7) === today().slice(0, 7),
      )
      .reduce((s: number, e: R) => s + e.amount, 0),
    income = data.expenses
      .filter(
        (e: R) =>
          e.kind === "income" &&
          e.date.slice(0, 7) === today().slice(0, 7),
      )
      .reduce((s: number, e: R) => s + e.amount, 0);
  const csv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([personalExpensesCsv(data.expenses)], {
        type: "text/csv",
      }),
    );
    a.download = "md-one-expenses.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>
            Make room for what matters<span className="gold-dot">.</span>
          </h1>
          <p>
            Everyday spending and your home’s bigger plans, privately organised.
          </p>
        </div>
        <Badge>
          <LockKeyhole size={13} />
          ONLY YOU CAN SEE THIS
        </Badge>
      </div>
      {view === "expenses" ? (
        <>
          <div className="metric-grid">
            <Metric
              title="Spent this month"
              value={money(spent)}
              icon={Wallet}
            />
            <Metric
              title="Income recorded"
              value={money(income)}
              icon={IndianRupee}
            />
            <Metric
              title="Entries recorded"
              value={String(data.expenses.length)}
              icon={FileText}
            />
          </div>
          <div className="two-column">
            <section className="panel">
              <SectionTitle title="Note a little expense" />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  const r = await act(
                    () =>
                      api("expenses", "POST", {
                        description: f.get("description"),
                        category: f.get("category"),
                        amount: Math.round(Number(f.get("amount")) * 100),
                        kind: f.get("kind"),
                        date: f.get("date"),
                      }),
                    "Entry saved privately",
                  );
                  if (r) form.reset();
                }}
              >
                <Field label="What was it for?">
                  <input
                    name="description"
                    required
                    maxLength={120}
                    placeholder="e.g. This week’s groceries"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Amount (₹)">
                    <input
                      name="amount"
                      required
                      type="number"
                      min="0.01"
                      max="10000000"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      name="date"
                      required
                      type="date"
                      defaultValue={today()}
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Category">
                    <select name="category">
                      {[
                        "Groceries",
                        "Bills",
                        "Travel",
                        "Dining",
                        "Health",
                        "Home",
                        "Other",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Entry type">
                    <select name="kind">
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>
                  <Plus size={16} />
                  Save entry
                </Button>
              </form>
            </section>
            <section className="panel">
              <SectionTitle
                title="The everyday ledger"
                action="Export CSV"
                onClick={csv}
              />
              {!data.expenses.length&&<p className="muted">No entries yet. Your first entry starts your private ledger.</p>}
              {data.expenses.map((e: R) => (
                <div className="ledger-row" key={e.id}>
                  <span className="document-icon">
                    <Wallet size={17} />
                  </span>
                  <div className="grow">
                    <b>{e.description}</b>
                    <small>
                      {day(e.date)} · {e.category}
                    </small>
                  </div>
                  <b>
                    {e.kind === "income" ? "+" : "−"}
                    {money(e.amount)}
                  </b>
                  <button
                    className="icon-button"
                    aria-label={`Archive ${e.description}`}
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api(`expenses/${e.id}`, "DELETE"),
                        "Entry moved to Trash. You can restore it.",
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </section>
          </div>
        </>
      ) : view === "loans" ? (
        <>
          <div className="toolbar">
            <h2>Your bigger plans</h2>
            <Button onClick={() => setAddLoan(true)}>
              <Plus size={16} />
              Add a loan
            </Button>
          </div>
          <div className="ride-grid">
            {!data.loans.length&&<Empty icon={Wallet} title="Your bigger plans, in one place" description="Add a loan to estimate its EMI and keep a monthly payment history."/>}
            {data.loans.map((l: R) => (
              <article className="panel loan-card" key={l.id}>
                <Badge>MANUAL TRACKING</Badge>
                <h2>{l.title}</h2>
                <div className="loan-principal">
                  {money(l.principal)}
                  <small>Original principal</small>
                </div>
                <p>
                  {l.rate}% annual rate · {l.months} months
                </p>
                <p className="muted">
                  Due day: {l.due_day} each month · estimated EMI {money(Math.round(l.estimate.emi * 100))}
                </p>
                <details><summary>Estimated repayment schedule</summary><p className="muted">Fixed-rate estimate from the original principal, separate from your manual payment history. Excludes lender fees and rate changes.</p><div className="schedule-table"><table><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Balance</th></tr></thead><tbody>{l.estimate.schedule.map((r:R)=><tr key={r.month}><td>{r.month}</td><td>{money(Math.round(r.payment*100))}</td><td>{money(Math.round(r.interest*100))}</td><td>{money(Math.round(r.balance*100))}</td></tr>)}</tbody></table></div></details>
                <p className="muted">Record the total paid for one month. Saving that month again corrects its total. No money is transferred.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    act(
                      () =>
                        api("loan-payment", "POST", {
                          loanId: l.id,
                          month: f.get("month"),
                          amount: Math.round(Number(f.get("amount")) * 100),
                        }),
                      "Monthly total saved by you; not bank verified",
                    );
                  }}
                >
                  <div className="form-grid">
                    <Field label="EMI month">
                      <input
                        name="month"
                        type="month"
                        max={today().slice(0,7)}
                        required
                        defaultValue={today().slice(0, 7)}
                      />
                    </Field>
                    <Field label="Amount paid (₹)">
                      <input
                        name="amount"
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                      />
                    </Field>
                  </div>
                  <Button variant="outline" type="submit" disabled={busy}>
                    Record a payment
                  </Button>
                </form>
                <p><b>{money(data.loanPayments.filter((p:R)=>p.loan_id===l.id).reduce((n:number,p:R)=>n+p.amount,0))}</b> recorded as paid · user marked</p>
                {data.loanPayments
                  .filter((p: R) => p.loan_id === l.id)
                  .map((p: R) => (
                    <div className="table-row" key={p.id}>
                      <span>
                        {p.month} · {money(p.amount)}
                      </span>
                      <Badge tone="amber">User marked</Badge>
                    </div>
                  ))}
                <Button variant="outline" disabled={busy} onClick={()=>void act(()=>api("archive-loan","POST",{id:l.id}),"Loan moved to Trash, including its payment history.")}>Archive loan</Button>
              </article>
            ))}
          </div>
          <div className="inline-note">
            Personal tracking and estimates only. Payments are recorded by you, not bank verified. MD One does not issue loans, transfer money, or send automatic EMI reminders.
          </div>
        </>
      ) : (
        <div className="two-column">
          <section className="panel">
            <SectionTitle title="A clearer picture of your EMI" />
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const r = await act(
                  () =>
                    api("emi", "POST", {
                      principal: Number(f.get("principal")),
                      rate: Number(f.get("rate")),
                      months: Number(f.get("months")),
                      prepayment: Number(f.get("prepayment")),
                    }),
                  "EMI calculated",
                );
                if (r) setCalc(r);
              }}
            >
              <Field label="Loan amount (₹)">
                <input
                  type="number"
                  name="principal"
                  min={1}
                  max={1e10}
                  required
                  defaultValue={3500000}
                />
              </Field>
              <div className="form-grid">
                <Field label="Annual interest (%)">
                  <input
                    type="number"
                    name="rate"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    defaultValue={8.5}
                  />
                </Field>
                <Field label="Tenure (months)">
                  <input
                    type="number"
                    name="months"
                    min={1}
                    max={600}
                    required
                    defaultValue={240}
                  />
                </Field>
              </div>
              <Field label="Extra payment every month (₹)">
                <input
                  type="number"
                  name="prepayment"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                />
              </Field>
              <Button type="submit" disabled={busy}>
                Calculate my EMI <ArrowRight size={16} />
              </Button>
            </form>
          </section>
          <section className="panel emi-result">
            {calc ? (
              <>
                <span className="eyebrow">ESTIMATED MONTHLY EMI</span>
                <h2>{money(Math.round(calc.emi * 100))}</h2>
                <div className="bill">
                  <div>
                    <span>Total interest</span>
                    <b>{money(Math.round(calc.totalInterest * 100))}</b>
                  </div>
                  <div>
                    <span>Total repayment</span>
                    <b>{money(Math.round(calc.totalRepayment * 100))}</b>
                  </div>
                  <div>
                    <span>Repayment length</span>
                    <b>{calc.months} months</b>
                  </div>
                </div>
                <p className="footnote muted">{calc.assumption}</p>
                <details>
                  <summary>View amortization schedule</summary>
                  <div className="schedule-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Payment</th>
                          <th>Interest</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.schedule.map((r: R) => (
                          <tr key={r.month}>
                            <td>{r.month}</td>
                            <td>{money(Math.round(r.payment * 100))}</td>
                            <td>{money(Math.round(r.interest * 100))}</td>
                            <td>{money(Math.round(r.balance * 100))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <Empty
                icon={Wallet}
                title="Plan with a little confidence"
                description="Enter your loan details to see repayment and monthly interest. Estimates exclude lender fees."
              />
            )}
          </section>
        </div>
      )}
      {addLoan && (
        <Modal
          title="Add a loan to your home"
          onClose={() => setAddLoan(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await act(
                () =>
                  api("loans", "POST", {
                    title: f.get("title"),
                    principal: Math.round(Number(f.get("principal")) * 100),
                    rate: Number(f.get("rate")),
                    months: Number(f.get("months")),
                    dueDay: Number(f.get("dueDay")),
                  }),
                "Loan added",
              );
              if (r) setAddLoan(false);
            }}
          >
            <Field label="Loan name">
              <input
                name="title"
                required
                maxLength={80}
                placeholder="e.g. Home loan"
              />
            </Field>
            <Field label="Original principal (₹)">
              <input
                name="principal"
                type="number"
                min={1}
                max={1e10}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Annual rate (%)">
                <input
                  name="rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Tenure (months)">
                <input name="months" type="number" min={1} max={600} required />
              </Field>
            </div>
            <Field label="Due day each month">
              <input
                name="dueDay"
                type="number"
                min={1}
                max={28}
                defaultValue={5}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Save loan
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function HostedPersonal({onAccount,initialView='documents'}:{onAccount:()=>void;initialView?:string}){
 const [data,setData]=useState<R|null>(null),[view,setView]=useState(initialView),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false);
 const load=useCallback(async()=>setData(await api('')),[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 useEffect(()=>{window.scrollTo(0,0);setNotice('');},[view]);
 const act=async(fn:()=>Promise<any>,message='Saved')=>{
  if(lock.current)return null;lock.current=true;setBusy(true);setError('');setNotice('');
  try{const r=await fn();setNotice(message);try{await load();}catch{setError('Saved, but the view could not refresh. Tap Refresh before adding another entry.');}return r;}catch(e:any){setError(e.message);return null;}finally{lock.current=false;setBusy(false);}
 };
 const active=data?{...data,expenses:data.expenses.filter((x:R)=>!x.archived_at),documents:data.documents.filter((x:R)=>!x.archived_at),loans:data.loans.filter((x:R)=>!x.archived_at).map((l:R)=>({...l,estimate:amortize(l.principal/100,Number(l.rate),l.months)}))}:null;
 return <section className="md-hosted-personal">
 <nav className="section-navigation" aria-label="My Home sections">{[['documents','Documents'],['expenses','Daily spending'],['loans','Loans & EMIs'],['calculator','EMI calculator'],['trash','Trash']].map(([id,label])=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>setView(id)}>{label}</button>)}<button className="md-live-refresh" aria-label="Refresh My Home" disabled={busy} onClick={()=>void act(load,'My Home refreshed')}><RefreshCw size={16}/></button></nav>
 {error&&<div className="md-store-message" role="alert">{error}</div>}{notice&&<div className="md-store-message" role="status">{notice}</div>}
 {!data?<div className="empty" role="status">Opening your private workspace…{error&&<Button onClick={()=>void act(load)}>Try again</Button>}</div>:view==='documents'?<Documents data={active} act={act} busy={busy}/>:view==='trash'?<><div className="page-heading"><div><span className="eyebrow">A LITTLE ROOM TO RECONSIDER</span><h1>Your recoverable records.</h1><p>Archived items remain private. Restore them whenever you need.</p></div></div>{['documents','expenses','loans'].map(kind=><section className="panel" key={kind}><h2>{({documents:'Documents',expenses:'Ledger entries',loans:'Loans & their payment histories'} as R)[kind]}</h2>{!data[kind].some((x:R)=>x.archived_at)&&<p className="muted">Nothing in Trash.</p>}{data[kind].filter((x:R)=>x.archived_at).map((x:R)=><div className="ledger-row" key={x.id}><span className="grow">{x.name||x.title||x.description}<small>Archived {day(x.archived_at)}</small></span><Button variant="outline" disabled={busy} onClick={()=>void act(()=>api('restore-'+({documents:'document',expenses:'expense',loans:'loan'} as R)[kind],'POST',{id:x.id}),'Record restored')}>Restore</Button></div>)}</section>)}</>:<Finance data={active} view={view} act={act} busy={busy}/>}
 <div className="personal-account"><LockKeyhole size={15}/><span>Private to your sign-in account. Project committees and other residents cannot access this workspace.</span><button className="text-link" onClick={onAccount}>Account & residence <ArrowUpRight size={15}/></button></div>
 </section>;
}
function Documents({data,act,busy}:any){
 const [folder,setFolder]=useState('Property'),[query,setQuery]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const upload=async(file:File)=>{
  if(file.size>2000000){await act(()=>Promise.reject(new Error('Choose a file below 2 MB.')));return;}
  await act(async()=>{const encoded=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('Could not read this file.'));r.readAsDataURL(file);});return api('document','POST',{name:file.name,folder,mime:file.type,data:encoded});},'Document stored privately. No public link was created.');
 };
 const docs=data.documents.filter((d:R)=>(d.name+' '+d.folder).toLowerCase().includes(query.toLowerCase()));
 return <>
 <div className="page-heading"><div><span className="eyebrow">A PLACE FOR EVERYTHING THAT MATTERS</span><h1>Home, thoughtfully organised<span className="gold-dot">.</span></h1><p>Your important papers, close at hand. Private to your account.</p></div><Badge><LockKeyhole size={13}/> PRIVATE TO YOU</Badge></div>
 <section className="vault-banner personal-vault"><FolderLock size={44} strokeWidth={1.2}/><div><h2>Important papers. A little peace of mind.</h2><p>Property records, household documents and the details worth keeping.</p></div><Button onClick={()=>input.current?.click()} disabled={busy}><Upload size={16}/>Upload document</Button><input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" aria-label="Choose private document" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/></section>
 <div className="personal-document-controls"><Field label="Save new uploads in"><select value={folder} onChange={e=>setFolder(e.target.value)}>{['Property','Identity','Insurance','Household','Other'].map(f=><option key={f}>{f}</option>)}</select></Field><Field label="Find a document"><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or folder"/></Field><p className="muted">PDF, JPEG or PNG · 2 MB per file<br/>{data.documents.length} active documents · 20 MB total vault capacity, including Trash</p></div>
 <p className="inline-note">Files are stored in your private Supabase workspace. Images are processed to remove metadata. PDFs have not been malware scanned; download only files you trust. No public sharing or inline PDF preview is enabled.</p>
 <div className="document-grid">{docs.map((d:R)=><article className="panel document-card" key={d.id}><div className="card-row"><span className="document-icon"><FileText size={25}/></span><Badge tone="amber">{d.mime==='application/pdf'?'Unscanned PDF':'Processed image'}</Badge></div><h3>{d.name}</h3><p>{d.folder} · {day(d.created)} · {Math.ceil(d.bytes/1024)} KB</p><div className="button-row"><a className="button outline" href={'/api/personal/documents/'+d.id} download><Download size={15}/>{d.mime==='application/pdf'?'Download unscanned PDF':'Download'}</a><button className="icon-button" aria-label={'Archive '+d.name} disabled={busy} onClick={()=>void act(()=>api('archive-document','POST',{id:d.id}),'Document moved to Trash. You can restore it.')}><Trash2 size={17}/></button></div></article>)}</div>
 {!docs.length&&<Empty icon={FolderLock} title={query?'No matching documents':'A little space for the important things'} description={query?'Try a different name or folder.':'Choose a folder, then upload your first document. Only your signed-in account can download it.'}/>}
 </>;
}
