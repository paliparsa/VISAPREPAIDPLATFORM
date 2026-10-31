import React, { FormEvent, useEffect, useState } from "react";
import { TremendousIntelligence } from "./TremendousIntelligence";

type Product = { id: string; name: string; description: string | null; currency: string; faceValueMinor: number; salePriceMinor: number; providerProductId?: string; enabled?: number; sortOrder?: number };
type Tab = "overview" | "products" | "orders" | "customers" | "provider" | "payments" | "activity" | "webhooks" | "intelligence";
type Props = { onMessage: (message: string, kind?: "success" | "error") => void };
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : response.status === 401 ? "نشست شما منقضی شده؛ دوباره وارد شوید." : response.status === 403 ? "این عملیات به دسترسی مدیر نیاز دارد." : "درخواست ناموفق بود؛ دوباره تلاش کنید.");
  return payload as T;
}
const money = (minor: number) => new Intl.NumberFormat("fa-IR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format((minor || 0) / 100);
const number = (value: unknown) => new Intl.NumberFormat("fa-IR").format(Number(value || 0));
const date = (value: string) => value ? new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")).toLocaleString("fa-IR") : "—";
const statusLabel = (value: string) => ({ PENDING_PAYMENT: "در انتظار پرداخت", AWAITING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت‌شده", ISSUING: "در حال صدور", ISSUED: "صادرشده", COMPLETED: "تکمیل‌شده", FAILED: "ناموفق", CANCELED: "لغوشده", AWAITING: "در انتظار", CONFIRMING: "در حال تأیید", MANUALLY_CONFIRMED: "تأیید دستی", ACTIVE: "فعال", PENDING_VERIFICATION: "در انتظار تأیید ایمیل" }[value] || value || "—");

export function AdminConsole({ onMessage }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState<any>(null);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [apiKey, setApiKey] = useState("");
  const [fundingSourceId, setFundingSourceId] = useState("");
  const [visaProductId, setVisaProductId] = useState("V4QZ00F554D3");
  const [fundingSources, setFundingSources] = useState<any[]>([]);
  const [providerTested, setProviderTested] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "", providerProductId: "V4QZ00F554D3", faceValue: "25", salePrice: "29", sortOrder: "0", enabled: false });

  async function loadOverview() { setLoading(true); try { setOverview(await api("/api/admin/operations/overview")); } catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری داشبورد ناموفق بود.", "error"); } finally { setLoading(false); } }
  async function loadProducts() { setLoading(true); try { const result = await api<{ products: Product[] }>("/api/admin/products"); setProducts(result.products); } catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری محصولات ناموفق بود.", "error"); } finally { setLoading(false); } }
  async function loadOrders(nextPage = 1, nextQuery = query, nextStatus = status) {
    setLoading(true);
    try { const params = new URLSearchParams({ page: String(nextPage), limit: "20" }); if (nextQuery) params.set("q", nextQuery); if (nextStatus) params.set("status", nextStatus); const result = await api<{ orders: any[]; total: number }>("/api/admin/operations/orders?" + params); setOrders(result.orders); setTotal(result.total); setPage(nextPage); }
    catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری سفارش‌ها ناموفق بود.", "error"); } finally { setLoading(false); }
  }
  async function loadCustomers(nextPage = 1, nextQuery = query) {
    setLoading(true);
    try { const params = new URLSearchParams({ page: String(nextPage), limit: "20" }); if (nextQuery) params.set("q", nextQuery); const result = await api<{ customers: any[]; total: number }>("/api/admin/operations/customers?" + params); setCustomers(result.customers); setTotal(result.total); setPage(nextPage); }
    catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری مشتریان ناموفق بود.", "error"); } finally { setLoading(false); }
  }
  async function loadProvider() {
    setLoading(true);
    try { const result = await api<any>("/api/admin/operations/settings"); setProvider(result.provider); setPaymentConfig(result.payments); setFundingSourceId(result.provider.fundingSourceId || ""); setVisaProductId(result.provider.visaProductId || "V4QZ00F554D3"); }
    catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری تنظیمات ناموفق بود.", "error"); } finally { setLoading(false); }
  }
  async function loadActivity() { setLoading(true); try { const result = await api<{ activity: any[] }>("/api/admin/operations/activity"); setActivity(result.activity); } catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری گزارش فعالیت ناموفق بود.", "error"); } finally { setLoading(false); } }
  async function loadWebhookEvents() { setLoading(true); try { const result = await api<{ events: any[] }>("/api/admin/operations/provider-events?limit=100"); setWebhookEvents(result.events); } catch (e) { onMessage(e instanceof Error ? e.message : "بارگذاری وب‌هوک‌ها ناموفق بود.", "error"); } finally { setLoading(false); } }

  useEffect(() => { void loadOverview(); }, []);
  useEffect(() => {
    if (tab === "overview") void loadOverview();
    if (tab === "products") void loadProducts();
    if (tab === "orders") void loadOrders(1);
    if (tab === "customers") void loadCustomers(1);
    if (tab === "provider" || tab === "payments") void loadProvider();
    if (tab === "activity") void loadActivity();
    if (tab === "webhooks") void loadWebhookEvents();
  }, [tab]);

  function resetProduct() { setForm({ id: "", name: "", description: "", providerProductId: "V4QZ00F554D3", faceValue: "25", salePrice: "29", sortOrder: "0", enabled: false }); }
  function editProduct(product: Product) { setForm({ id: product.id, name: product.name, description: product.description || "", providerProductId: product.providerProductId || "V4QZ00F554D3", faceValue: (product.faceValueMinor / 100).toFixed(2), salePrice: (product.salePriceMinor / 100).toFixed(2), sortOrder: String(product.sortOrder || 0), enabled: Boolean(product.enabled) }); document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const faceValueMinor = Math.round(Number(form.faceValue) * 100);
    const salePriceMinor = Math.round(Number(form.salePrice) * 100);
    if (!form.name.trim() || !form.providerProductId.trim() || !Number.isFinite(faceValueMinor) || !Number.isFinite(salePriceMinor) || faceValueMinor < 100 || salePriceMinor < faceValueMinor) { onMessage("نام، شناسه و قیمت‌ها را بررسی کنید. قیمت فروش نباید کمتر از ارزش کارت باشد.", "error"); return; }
    setBusy(true);
    try {
      const body = { name: form.name, description: form.description, providerProductId: form.providerProductId, faceValueMinor, salePriceMinor, sortOrder: Number(form.sortOrder) || 0, enabled: form.enabled };
      await api(form.id ? `/api/admin/products/${form.id}` : "/api/admin/products", { method: form.id ? "PUT" : "POST", body: JSON.stringify(body) });
      onMessage(form.id ? "محصول به‌روزرسانی شد." : "محصول ساخته شد."); resetProduct(); await loadProducts();
    } catch (e) { onMessage(e instanceof Error ? e.message : "ذخیره محصول ناموفق بود.", "error"); } finally { setBusy(false); }
  }
  async function disableProduct(product: Product) {
    setBusy(true);
    try { await api(`/api/admin/products/${product.id}`, { method: "DELETE" }); onMessage("محصول غیرفعال شد."); await loadProducts(); }
    catch (e) { onMessage(e instanceof Error ? e.message : "غیرفعال‌سازی ناموفق بود.", "error"); } finally { setBusy(false); }
  }
  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await api("/api/admin/operations/settings/provider", { method: "POST", body: JSON.stringify({ apiKey, fundingSourceId, visaProductId }) });
      setApiKey(""); onMessage("تنظیمات ارائه‌دهنده با رمزنگاری ذخیره شد."); await loadProvider();
    } catch (e) { onMessage(e instanceof Error ? e.message : "ذخیره تنظیمات ناموفق بود.", "error"); } finally { setBusy(false); }
  }
  async function testProvider() {
    setBusy(true); setProviderTested(false); setFundingSources([]);
    try { const result = await api<{ connected: boolean; fundingSources: any[] }>("/api/admin/operations/provider/test", { method: "POST", body: "{}" }); setFundingSources(result.fundingSources); setProviderTested(true); onMessage("اتصال به Tremendous برقرار شد."); }
    catch (e) { onMessage(e instanceof Error ? e.message : "تست اتصال ناموفق بود.", "error"); } finally { setBusy(false); }
  }

  async function confirmManualPayment(order: any) {
    const reference = window.prompt("مرجع پرداختی را که خارج از سامانه بررسی کرده‌اید وارد کنید:");
    if (!reference?.trim()) return;
    const note = window.prompt("یادداشت بررسی (اختیاری):") || "";
    setBusy(true);
    try {
      await api(`/api/admin/operations/orders/${encodeURIComponent(order.id)}/confirm-payment`, { method: "POST", body: JSON.stringify({ reference: reference.trim(), note }) });
      onMessage("پرداخت با مرجع ثبت‌شده تأیید شد؛ سفارش وارد صف صدور دستی شد.");
      await loadOrders(page);
    } catch (e) { onMessage(e instanceof Error ? e.message : "تأیید پرداخت ناموفق بود.", "error"); }
    finally { setBusy(false); }
  }
  async function recordManualIssuance(order: any) {
    const providerOrderId = window.prompt("شناسه سفارش صادرشده در داشبورد Tremendous:");
    if (!providerOrderId?.trim()) return;
    const deliveryUrl = window.prompt("لینک تحویل امن (اختیاری؛ فقط HTTPS):") || "";
    const note = window.prompt("یادداشت داخلی (اختیاری):") || "";
    setBusy(true);
    try {
      await api(`/api/admin/operations/orders/${encodeURIComponent(order.id)}/manual-issuance`, { method: "POST", body: JSON.stringify({ providerOrderId: providerOrderId.trim(), deliveryUrl: deliveryUrl.trim(), note }) });
      onMessage("صدور دستی ثبت شد؛ هیچ تراکنش API ایجاد نشد.");
      await loadOrders(page);
    } catch (e) { onMessage(e instanceof Error ? e.message : "ثبت صدور ناموفق بود.", "error"); }
    finally { setBusy(false); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "نمای کلی" }, { id: "products", label: "محصولات" }, { id: "orders", label: "سفارش‌ها" },
    { id: "customers", label: "مشتریان" }, { id: "provider", label: "اتصال Tremendous" }, { id: "intelligence", label: "هوشمندی Tremendous" }, { id: "webhooks", label: "وب‌هوک‌ها" }, { id: "payments", label: "پرداخت‌ها" }, { id: "activity", label: "گزارش فعالیت" }
  ];
  const stats = overview ? [
    ["کاربران", overview.users?.total, `${number(overview.users?.active)} حساب فعال`],
    ["محصولات", overview.products?.total, `${number(overview.products?.enabled)} محصول فعال`],
    ["سفارش‌ها", overview.orders?.total, `${number(overview.orders?.awaitingPayment)} در انتظار پرداخت`],
    ["پرداخت‌ها", overview.payments?.total, `${number(overview.payments?.pending)} در انتظار`],
    ["کارت‌های صادرشده", overview.issuance?.issued, `${number(overview.issuance?.failed)} صدور ناموفق`]
  ] : [];

  return <section className="admin-console">
    <div className="admin-console-head"><div><div className="kicker"><span /> OPERATIONS CENTER</div><h2>مرکز مدیریت سامانه</h2><p>مدیریت محصولات، مشتریان، سفارش‌ها و اتصال ارائه‌دهنده</p></div><span className="account-status"><span className="status-dot" /> دسترسی مدیر</span></div>
    <nav className="admin-nav" aria-label="بخش‌های مدیریت">{tabs.map(item => <button key={item.id} className={tab === item.id ? "selected" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setQuery(""); setStatus(""); setPage(1); setTab(item.id); }}>{item.label}</button>)}</nav>
    {loading && <div className="admin-loading"><span className="spinner spinner-small" /> در حال دریافت اطلاعات…</div>}

    {tab === "overview" && <div className="admin-pane">
      <div className="pane-title"><div><h3>وضعیت سامانه</h3><p>آمار زنده از پایگاه داده</p></div><button className="button button-quiet" onClick={() => void loadOverview()} disabled={loading}>به‌روزرسانی</button></div>
      <div className="ops-stats">{stats.map(([label, value, hint]) => <article className="stat-card" key={String(label)}><small>{label}</small><strong>{number(value)}</strong><span>{hint}</span></article>)}</div>
      <div className="ops-callout"><b>وضعیت عملیاتی</b><p>پرداخت را فقط پس از بررسی مستقل مرجع تراکنش تأیید کنید. سپس سفارش را در داشبورد Tremendous به‌صورت دستی صادر و شناسه آن را اینجا ثبت کنید. هیچ پرداخت یا صدوری به‌صورت خودکار انجام نمی‌شود.</p></div>
    </div>}

    {tab === "products" && <div className="admin-pane">
      <div className="pane-title"><div><h3>کاتالوگ محصولات</h3><p>قیمت‌ها برحسب دلار آمریکا و واحد سنت ذخیره می‌شوند.</p></div></div>
      <form id="product-editor" className="product-editor" onSubmit={saveProduct} noValidate>
        <div className="editor-title"><h3>{form.id ? "ویرایش محصول" : "افزودن محصول"}</h3>{form.id && <button type="button" className="text-button" onClick={resetProduct}>لغو ویرایش</button>}</div>
        <div className="editor-grid">
          <label>نام محصول<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} required /></label>
          <label>شناسه محصول Tremendous<input value={form.providerProductId} onChange={e => setForm({ ...form, providerProductId: e.target.value })} dir="ltr" required /></label>
          <label>ارزش کارت (USD)<input type="number" min="1" step="0.01" value={form.faceValue} onChange={e => setForm({ ...form, faceValue: e.target.value })} dir="ltr" required /></label>
          <label>قیمت فروش (USD)<input type="number" min="1" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} dir="ltr" required /></label>
          <label>ترتیب نمایش<input type="number" min="0" max="10000" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} dir="ltr" /></label>
          <label className="wide-field">توضیحات<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={500} /></label>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> نمایش محصول در کاتالوگ عمومی</label>
        <div className="editor-actions"><button className="button button-primary" disabled={busy}>{busy ? "در حال ذخیره…" : form.id ? "ذخیره تغییرات" : "ایجاد محصول"}</button></div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>محصول</th><th>ارزش کارت</th><th>قیمت فروش</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
        {products.length ? products.map(product => <tr key={product.id}><td><strong>{product.name}</strong><small className="sub-cell">{product.providerProductId || "Tremendous"}</small></td><td dir="ltr">{money(product.faceValueMinor)}</td><td dir="ltr">{money(product.salePriceMinor)}</td><td><span className={product.enabled ? "pill pill-on" : "pill"}>{product.enabled ? "فعال" : "غیرفعال"}</span></td><td className="row-actions"><button className="text-button" onClick={() => editProduct(product)}>ویرایش</button>{Boolean(product.enabled) && <button className="text-button danger-text" onClick={() => void disableProduct(product)} disabled={busy}>غیرفعال‌سازی</button>}</td></tr>) : <tr><td colSpan={5} className="empty-cell">هنوز محصولی ثبت نشده است.</td></tr>}
      </tbody></table></div>
    </div>}

    {tab === "orders" && <div className="admin-pane">
      <div className="pane-title"><div><h3>سفارش‌ها</h3><p>{number(total)} سفارش ثبت‌شده؛ پرداخت و صدور فقط با تأیید دستی مدیر ثبت می‌شوند؛ هیچ API یا پرداخت خودکاری اجرا نمی‌شود.</p></div></div>
      <form className="filter-bar" onSubmit={e => { e.preventDefault(); void loadOrders(1, query, status); }} noValidate><input aria-label="جست‌وجوی سفارش" placeholder="شناسه سفارش یا ایمیل…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="فیلتر وضعیت" value={status} onChange={e => setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option><option value="PENDING_PAYMENT">در انتظار پرداخت</option><option value="PAID">پرداخت‌شده</option><option value="ISSUING">در حال صدور</option><option value="ISSUED">صادرشده</option><option value="FAILED">ناموفق</option><option value="ISSUED">صادرشده</option></select><button className="button button-primary">جست‌وجو</button></form>
      <div className="table-wrap"><table><thead><tr><th>شناسه</th><th>مشتری</th><th>محصول</th><th>مبلغ</th><th>پرداخت</th><th>صدور</th><th>مرجع پرداخت</th><th>ثبت</th><th>اقدام دستی</th></tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.id}><td dir="ltr">{order.id.slice(0, 10)}</td><td><strong>{order.recipientName || order.customerEmail}</strong><small className="sub-cell">{order.recipientEmail || order.customerEmail}</small></td><td>{order.productName || "—"}</td><td dir="ltr">{money(order.salePriceMinor)}</td><td><span className="pill">{statusLabel(order.paymentStatus || order.status)}</span></td><td><span className="pill">{statusLabel(order.issuanceStatus || "—")}</span>{order.providerOrderId && <small className="sub-cell">Tremendous: {order.providerOrderId}</small>}{order.providerLastEvent && <small className="sub-cell">رویداد اخیر: {order.providerLastEvent} · {order.providerStatus}</small>}{order.deliveryUrl && <small className="sub-cell">لینک تحویل ثبت شده</small>}</td><td dir="ltr">{order.manualPaymentReference || "—"}</td><td>{date(order.createdAt)}</td><td className="row-actions">{["PENDING_PAYMENT","AWAITING_PAYMENT"].includes(order.status) ? <button className="text-button" disabled={busy} onClick={() => void confirmManualPayment(order)}>تأیید پرداخت</button> : null}{["PAID","ISSUING"].includes(order.status) ? <button className="text-button" disabled={busy} onClick={() => void recordManualIssuance(order)}>ثبت صدور دستی</button> : null}{order.status === "ISSUED" ? <span className="pill pill-on">تکمیل‌شده</span> : null}</td></tr>) : <tr><td colSpan={9} className="empty-cell">{loading ? "در حال بارگذاری…" : "هنوز سفارشی ثبت نشده است."}</td></tr>}</tbody></table></div>
      <div className="pagination"><span>{number(total)} نتیجه</span><div><button className="button button-quiet" disabled={page <= 1 || loading} onClick={() => void loadOrders(page - 1)}>قبلی</button><span>صفحه {number(page)}</span><button className="button button-quiet" disabled={page * 20 >= total || loading} onClick={() => void loadOrders(page + 1)}>بعدی</button></div></div>
    </div>}

    {tab === "customers" && <div className="admin-pane">
      <div className="pane-title"><div><h3>مشتریان و حساب‌ها</h3><p>{number(total)} حساب در سامانه</p></div></div>
      <form className="filter-bar" onSubmit={e => { e.preventDefault(); void loadCustomers(1, query); }} noValidate><input aria-label="جست‌وجوی مشتری" placeholder="ایمیل، نام یا نام خانوادگی…" value={query} onChange={e => setQuery(e.target.value)} /><button className="button button-primary">جست‌وجو</button></form>
      <div className="table-wrap"><table><thead><tr><th>مشتری</th><th>کشور محل اقامت</th><th>نقش</th><th>سفارش‌ها</th><th>وضعیت</th><th>عضویت</th></tr></thead><tbody>{customers.length ? customers.map(customer => <tr key={customer.id}><td><strong>{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "بدون نام"}</strong><small className="sub-cell">{customer.email}</small></td><td>{customer.country || "—"}</td><td>{customer.role}</td><td>{number(customer.orderCount)}</td><td><span className="pill">{statusLabel(customer.status)}</span></td><td>{date(customer.createdAt)}</td></tr>) : <tr><td colSpan={6} className="empty-cell">{loading ? "در حال بارگذاری…" : "مشتری‌ای پیدا نشد."}</td></tr>}</tbody></table></div>
      <div className="pagination"><span>{number(total)} نتیجه</span><div><button className="button button-quiet" disabled={page <= 1 || loading} onClick={() => void loadCustomers(page - 1)}>قبلی</button><span>صفحه {number(page)}</span><button className="button button-quiet" disabled={page * 20 >= total || loading} onClick={() => void loadCustomers(page + 1)}>بعدی</button></div></div>
    </div>}

    {tab === "provider" && <div className="admin-pane">
      <div className="pane-title"><div><h3>اتصال به Tremendous</h3><p>کلید API در پایگاه داده با AES-GCM رمزنگاری می‌شود و هرگز به مرورگر برگردانده نمی‌شود.</p></div><span className={provider?.apiKeyConfigured ? "pill pill-on" : "pill"}>{provider?.apiKeyConfigured ? "کلید تنظیم شده" : "بدون کلید API"}</span></div>
      <div className="provider-meta"><div><small>محیط فعال</small><b>{provider?.mode === "live" ? "Live" : "Sandbox"}</b></div><div><small>رمزنگاری ذخیره‌سازی</small><b>{provider?.encryptionReady ? "آماده" : "نیازمند ENCRYPTION_KEY"}</b></div><div><small>منبع مالی</small><b dir="ltr">{provider?.fundingSourceId || "تنظیم نشده"}</b></div></div>
      {!provider?.encryptionReady && <div className="ops-callout warning"><b>یک تنظیم Cloudflare لازم است</b><p>در Worker → Settings → Variables and Secrets، یک Secret با نام ENCRYPTION_KEY بسازید. مقدار آن باید Base64 معتبرِ دقیقاً ۳۲ بایت باشد. نمونه ساخت: <code>openssl rand -base64 32</code></p></div>}
      <form className="product-editor provider-form" onSubmit={saveProvider} noValidate>
        <label>کلید API جدید<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="new-password" dir="ltr" placeholder={provider?.apiKeyConfigured ? "برای حفظ کلید فعلی خالی بگذارید" : "Tremendous API key"} /></label>
        <div className="editor-grid"><label>Funding Source ID<input value={fundingSourceId} onChange={e => setFundingSourceId(e.target.value)} dir="ltr" placeholder="BALANCE یا شناسه منبع" /></label><label>Virtual Visa Product ID<input value={visaProductId} onChange={e => setVisaProductId(e.target.value)} dir="ltr" /></label></div>
        <p className="admin-note">این فرم کلید و تنظیمات Sandbox را ذخیره می‌کند. فعال‌سازی Live فقط از طریق Cloudflare و پس از تأیید کتبی ارائه‌دهنده مجاز است.</p>
        <div className="editor-actions"><button className="button button-primary" disabled={busy || !provider?.encryptionReady}>ذخیره تنظیمات</button><button type="button" className="button button-quiet" onClick={() => void testProvider()} disabled={busy || !provider?.apiKeyConfigured}>تست اتصال</button></div>
      </form>
      {providerTested && <div className="provider-results"><h4>منابع مالی قابل مشاهده</h4>{fundingSources.length ? <div className="table-wrap"><table><thead><tr><th>شناسه</th><th>نوع</th><th>وضعیت</th><th>اجازه سفارش API</th><th>موجودی (USD)</th></tr></thead><tbody>{fundingSources.map((source, i) => <tr key={source.id || i}><td dir="ltr">{source.id}</td><td>{source.method}</td><td>{source.status}</td><td>{source.canPayApiOrders ? "دارد" : "ندارد"}</td><td dir="ltr">{source.availableCents == null ? "—" : money(source.availableCents)}</td></tr>)}</tbody></table></div> : <p className="admin-note">اتصال برقرار شد اما منبع مالی‌ای برنگشت.</p>}</div>}
      <p className="admin-note">تست اتصال فقط درخواست GET به فهرست منابع مالی ارسال می‌کند و هیچ سفارش یا تراکنش مالی ایجاد نمی‌کند.</p>
    </div>}

    {tab === "payments" && <div className="admin-pane">
      <div className="pane-title"><div><h3>تنظیمات پرداخت و شبکه‌ها</h3><p>وضعیت متغیرهای Worker؛ مقادیر حساس نمایش داده نمی‌شوند.</p></div></div>
      <div className="provider-meta"><div><small>حالت صدور</small><b>{paymentConfig?.issuanceMode || "MANUAL_APPROVAL"}</b></div><div><small>پایش رمزارز</small><b>{paymentConfig?.cryptoMonitoringImplemented ? "فعال" : "پیاده‌سازی نشده"}</b></div><div><small>Checkout</small><b>{paymentConfig?.checkoutImplemented ? "فعال" : "پیاده‌سازی نشده"}</b></div></div>
      <h4 className="subheading">شبکه‌های پیکربندی‌شده</h4><div className="chain-list">{(paymentConfig?.enabledChains || []).map((chain: string) => <div key={chain}><b>{chain}</b><span className="pill">متغیر Worker تنظیم شده</span></div>)}{!paymentConfig?.enabledChains?.length && <p className="admin-note">هیچ شبکه‌ای در ENABLED_CHAINS تعریف نشده است.</p>}</div>
      <div className="ops-callout warning"><b>پرداخت زنده هنوز فعال نیست</b><p>فعال‌بودن نام شبکه در تنظیمات به معنی اتصال کیف پول، پایش تراکنش یا تأیید پرداخت نیست. برای جلوگیری از دریافت پول بدون امکان تطبیق، سفارش‌گیری و پرداخت رمزارزی تا تکمیل مانیتورینگ، مدیریت آدرس‌ها، تأییدیه‌ها و بررسی انطباق غیرفعال می‌ماند.</p></div>
      <div className="ops-callout"><b>تغییر متغیرهای شبکه</b><p>مقادیر ENABLED_CHAINS و ISSUANCE_MODE فعلاً از Cloudflare Worker → Settings → Variables and Secrets خوانده می‌شوند؛ این پنل آن‌ها را تغییر نمی‌دهد.</p></div>
    </div>}

    {tab === "intelligence" && <div className="admin-pane"><TremendousIntelligence onMessage={onMessage} /></div>}

    {tab === "webhooks" && <div className="admin-pane">
      <div className="pane-title"><div><h3>رویدادهای Tremendous</h3><p>رویدادهای تأییدشده Gateway، وضعیت تطبیق با سفارش و خطاهای پردازش</p></div><button className="button button-quiet" onClick={() => void loadWebhookEvents()} disabled={loading}>به‌روزرسانی</button></div>
      <div className="ops-callout"><b>امنیت و وضعیت</b><p>فقط رویدادهایی که امضای Gateway آن‌ها معتبر باشد ثبت می‌شوند. رویدادهای نامرتبط یا فاقد سفارش متناظر به‌صورت جداگانه نگهداری می‌شوند و به‌تنهایی پرداخت یا صدور را تأیید نمی‌کنند.</p></div>
      <div className="table-wrap"><table><thead><tr><th>شناسه رویداد</th><th>نوع</th><th>منبع</th><th>سفارش پنل</th><th>وضعیت</th><th>خطا</th><th>زمان</th></tr></thead><tbody>
        {webhookEvents.length ? webhookEvents.map(item => <tr key={item.id}><td dir="ltr">{String(item.eventId).slice(0, 14)}</td><td><strong>{item.eventType}</strong></td><td dir="ltr">{item.resourceType || "—"} / {item.resourceId || "—"}</td><td dir="ltr">{item.orderId || "—"}</td><td><span className="pill">{item.processingStatus}</span></td><td>{item.lastError || "—"}</td><td>{date(item.createdAt)}</td></tr>) : <tr><td colSpan={7} className="empty-cell">هنوز وب‌هوکی به پنل اصلی نرسیده است.</td></tr>}
      </tbody></table></div>
    </div>}
    {tab === "activity" && <div className="admin-pane">
      <div className="pane-title"><div><h3>گزارش فعالیت مدیران</h3><p>آخرین رویدادهای ثبت‌شده در audit log</p></div><button className="button button-quiet" onClick={() => void loadActivity()} disabled={loading}>به‌روزرسانی</button></div>
      <div className="table-wrap"><table><thead><tr><th>رویداد</th><th>مدیر</th><th>نوع رکورد</th><th>شناسه</th><th>جزئیات</th><th>زمان</th></tr></thead><tbody>{activity.length ? activity.map(item => <tr key={item.id}><td><strong>{item.action}</strong></td><td>{item.actorEmail || "سیستم"}</td><td>{item.entityType}</td><td dir="ltr">{String(item.entityId).slice(0, 14)}</td><td className="audit-meta">{item.metadata ? String(item.metadata).slice(0, 90) : "—"}</td><td>{date(item.createdAt)}</td></tr>) : <tr><td colSpan={6} className="empty-cell">هنوز رویدادی ثبت نشده است.</td></tr>}</tbody></table></div>
    </div>}
  </section>;
}
