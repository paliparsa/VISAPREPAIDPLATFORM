import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type User = { id: string; email: string; role: string };
type Product = { id: string; name: string; description: string | null; currency: string; faceValueMinor: number; salePriceMinor: number; providerProductId?: string; enabled?: number; sortOrder?: number };
type ProductForm = { id?: string; name: string; description: string; providerProductId: string; faceValue: string; salePrice: string; sortOrder: string; enabled: boolean };
const emptyProduct: ProductForm = { name: "", description: "", providerProductId: "V4QZ00F554D3", faceValue: "25", salePrice: "29", sortOrder: "0", enabled: false };
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(typeof payload.message === "string" ? payload.message : response.status === 401 ? "برای ادامه وارد حساب شوید." : response.status === 403 ? "اجازه دسترسی به این بخش را ندارید." : "درخواست انجام نشد. دوباره تلاش کنید.", response.status);
  return payload as T;
}
const money = (minor: number) => new Intl.NumberFormat("fa-IR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(minor / 100);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [showBootstrapToken, setShowBootstrapToken] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  async function refreshUser() {
    try { const result = await api<{ user: User }>("/api/auth/me"); setUser(result.user); }
    catch { setUser(null); }
  }
  async function loadProducts() {
    try {
      const result = user && ["OWNER", "ADMIN"].includes(user.role)
        ? await api<{ products: Product[] }>("/api/admin/products")
        : await api<{ products: Product[] }>("/api/catalog");
      setProducts(result.products);
    } catch (e) { setError(e instanceof Error ? e.message : "بارگذاری محصولات ناموفق بود."); }
  }
  useEffect(() => {
    let alive = true;
    async function initialize() {
      const verifyToken = new URLSearchParams(window.location.search).get("verify");
      if (verifyToken) {
        try {
          const result = await api<{ message: string }>("/api/auth/verify", { method: "POST", body: JSON.stringify({ token: verifyToken }) });
          if (alive) setNotice(result.message);
        } catch (e) { if (alive) setError(e instanceof Error ? e.message : "تأیید ایمیل ناموفق بود."); }
        finally { window.history.replaceState({}, "", window.location.pathname); }
      }
      try { const result = await api<{ user: User }>("/api/auth/me"); if (alive) setUser(result.user); }
      catch { /* signed out */ }
      if (alive) setLoading(false);
    }
    void initialize();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    document.title = user ? "حساب کاربری | Visa Prepaid" : "ورود و ثبت‌نام | Visa Prepaid";
    if (user) {
      void loadProducts();
      void api<{ available: boolean }>("/api/admin/bootstrap/status").then(result => setBootstrapAvailable(result.available)).catch(() => setBootstrapAvailable(false));
    } else setBootstrapAvailable(false);
  }, [user]);

  function resetMessages() { setError(""); setNotice(""); }
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError("یک ایمیل معتبر وارد کنید."); return; }
    if (mode === "register" && (!firstName.trim() || !lastName.trim())) { setError("نام و نام خانوادگی را وارد کنید."); return; }
    if (mode === "register" && password.length < 12) { setError("رمز عبور باید حداقل ۱۲ کاراکتر داشته باشد."); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        const result = await api<{ message: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, firstName, lastName }) });
        setNotice(result.message); setMode("login"); setPassword("");
      } else {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        await refreshUser(); setPassword("");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "درخواست انجام نشد."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); resetMessages();
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); setUser(null); setProducts([]); setNotice("از حساب خارج شدید."); }
    catch (e) { setError(e instanceof Error ? e.message : "خروج ناموفق بود."); }
    finally { setBusy(false); }
  }
  async function bootstrapOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages(); setBusy(true);
    try {
      const result = await api<{ message: string }>("/api/admin/bootstrap", { method: "POST", body: JSON.stringify({ email: user?.email, token: bootstrapToken }) });
      setNotice(result.message); setBootstrapToken(""); setBootstrapAvailable(false); await refreshUser();
    } catch (e) { setError(e instanceof Error ? e.message : "فعال‌سازی مدیر ناموفق بود."); }
    finally { setBusy(false); }
  }
  function editProduct(product: Product) {
    setProductForm({ id: product.id, name: product.name, description: product.description || "", providerProductId: product.providerProductId || "V4QZ00F554D3", faceValue: (product.faceValueMinor / 100).toFixed(2), salePrice: (product.salePriceMinor / 100).toFixed(2), sortOrder: String(product.sortOrder || 0), enabled: Boolean(product.enabled) });
    document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages();
    const faceValueMinor = Math.round(Number(productForm.faceValue) * 100);
    const salePriceMinor = Math.round(Number(productForm.salePrice) * 100);
    if (!productForm.name.trim() || !productForm.providerProductId.trim() || !Number.isFinite(faceValueMinor) || !Number.isFinite(salePriceMinor) || faceValueMinor < 100 || salePriceMinor < faceValueMinor) {
      setError("نام، شناسه محصول و قیمت‌ها را بررسی کنید. قیمت فروش نباید از ارزش کارت کمتر باشد."); return;
    }
    setSavingProduct(true);
    const body = { name: productForm.name, description: productForm.description, providerProductId: productForm.providerProductId, faceValueMinor, salePriceMinor, sortOrder: Number(productForm.sortOrder) || 0, enabled: productForm.enabled };
    try {
      await api(productForm.id ? `/api/admin/products/${productForm.id}` : "/api/admin/products", { method: productForm.id ? "PUT" : "POST", body: JSON.stringify(body) });
      setNotice(productForm.id ? "محصول به‌روزرسانی شد." : "محصول ساخته شد."); setProductForm(emptyProduct); await loadProducts();
    } catch (e) { setError(e instanceof Error ? e.message : "ذخیره محصول ناموفق بود."); }
    finally { setSavingProduct(false); }
  }
  async function disableProduct(product: Product) {
    resetMessages();
    try { await api(`/api/admin/products/${product.id}`, { method: "DELETE" }); setNotice("محصول غیرفعال شد."); await loadProducts(); }
    catch (e) { setError(e instanceof Error ? e.message : "غیرفعال‌سازی ناموفق بود."); }
  }

  if (loading) return <main className="loading-screen"><span className="spinner" />در حال آماده‌سازی حساب…</main>;
  return <main className="app-shell" dir="rtl">
    <header className="topbar">
      <a className="brand" href="/" aria-label="صفحه اصلی"><span className="brand-mark"><i /></span><span><b>VISA PREPAID</b><small>کارت مجازی، ساده و امن</small></span></a>
      {user ? <div className="account-tools"><span className="account-email">{user.email}</span><button className="button button-quiet" onClick={logout} disabled={busy}>خروج</button></div> : <span className="top-note">محیط آماده‌سازی سرویس</span>}
    </header>
    {(notice || error) && <div className={`message ${error ? "message-error" : "message-success"}`} role="status" aria-live="polite"><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="بستن پیام">×</button></div>}
    {!user ? <section className="auth-layout">
      <div className="intro">
        <div className="kicker"><span /> PREPAID, ON YOUR TERMS</div>
        <h1>پرداخت‌های بین‌المللی،<br /><em>با یک کارت مجازی.</em></h1>
        <p>حساب بسازید، محصولات فعال را ببینید و سفارش کارت خود را از یک فضای امن مدیریت کنید.</p>
        <div className="card-preview"><div className="card-preview-top"><span>VISA</span><span className="chip" /></div><div className="card-preview-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 2048</div><div className="card-preview-bottom"><span>VIRTUAL PREPAID</span><span>USD</span></div></div>
        <div className="trust-line"><span className="trust-dot" /> صدور کارت پس از تأیید پرداخت و بررسی شرایط ارائه‌دهنده</div>
      </div>
      <section className="auth-panel">
        <div className="auth-tabs" role="tablist" aria-label="ورود یا ثبت‌نام">
          <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); resetMessages(); }}>ورود</button>
          <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); resetMessages(); }}>ساخت حساب</button>
        </div>
        <h2>{mode === "login" ? "خوش برگشتید" : "حساب جدید بسازید"}</h2><p className="panel-subtitle">{mode === "login" ? "برای ورود، اطلاعات حساب خود را وارد کنید." : "برای شروع فقط چند مورد کوتاه لازم است."}</p>
        <form onSubmit={submitAuth} noValidate>
          {mode === "register" && <div className="field-row"><label>نام<input value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" maxLength={80} /></label><label>نام خانوادگی<input value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" maxLength={80} /></label></div>}
          <label>ایمیل<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" dir="ltr" /></label>
          <label>رمز عبور<div className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} dir="ltr" /><button type="button" className="reveal" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}>{showPassword ? "مخفی" : "نمایش"}</button></div></label>
          {mode === "register" && <p className="field-hint">حداقل ۱۲ کاراکتر؛ امکان استفاده از مدیر رمز عبور و Paste فعال است.</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-small" /> در حال انجام…</> : mode === "login" ? "ورود به حساب" : "ساخت حساب"}</button>
        </form>
        <div className="auth-foot">{mode === "login" ? "حساب ندارید؟" : "قبلاً حساب ساخته‌اید؟"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); resetMessages(); }}>{mode === "login" ? "ثبت‌نام کنید" : "وارد شوید"}</button></div>
      </section>
    </section> : <section className="dashboard">
      <div className="dashboard-heading"><div><div className="kicker"><span /> ACCOUNT OVERVIEW</div><h1>سلام، خوش آمدید.</h1><p>از اینجا می‌توانید محصولات قابل سفارش و وضعیت دسترسی خود را ببینید.</p></div><div className="account-status"><span className="status-dot" /> حساب فعال</div></div>
      <div className="stats-grid"><article className="stat-card"><small>وضعیت حساب</small><strong>فعال</strong><span>ایمیل تأیید شده</span></article><article className="stat-card"><small>محصولات قابل سفارش</small><strong>{products.length.toLocaleString("fa-IR")}</strong><span>بر اساس کاتالوگ ارائه‌دهنده</span></article><article className="stat-card"><small>ارز پایه</small><strong>USD</strong><span>دلار آمریکا</span></article></div>
      {["OWNER", "ADMIN"].includes(user.role) ? <section className="admin-section">
        <div className="section-heading"><div><div className="kicker"><span /> MANAGEMENT</div><h2>مدیریت کاتالوگ</h2></div></div>
        <>
          <form id="product-editor" className="product-editor" onSubmit={saveProduct} noValidate>
            <div className="editor-title"><h3>{productForm.id ? "ویرایش محصول" : "افزودن محصول"}</h3>{productForm.id && <button type="button" className="text-button" onClick={() => setProductForm(emptyProduct)}>لغو ویرایش</button>}</div>
            <div className="editor-grid">
              <label>نام محصول<input value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})} maxLength={100} /></label>
              <label>شناسه محصول ارائه‌دهنده<input value={productForm.providerProductId} onChange={e => setProductForm({...productForm,providerProductId:e.target.value})} dir="ltr" /></label>
              <label>ارزش کارت (USD)<input type="number" min="1" step="0.01" value={productForm.faceValue} onChange={e => setProductForm({...productForm,faceValue:e.target.value})} dir="ltr" /></label>
              <label>قیمت فروش (USD)<input type="number" min="1" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm,salePrice:e.target.value})} dir="ltr" /></label>
              <label>ترتیب نمایش<input type="number" min="0" max="10000" value={productForm.sortOrder} onChange={e => setProductForm({...productForm,sortOrder:e.target.value})} dir="ltr" /></label>
              <label className="wide-field">توضیحات<input value={productForm.description} onChange={e => setProductForm({...productForm,description:e.target.value})} maxLength={500} /></label>
            </div>
            <label className="toggle-row"><input type="checkbox" checked={productForm.enabled} onChange={e => setProductForm({...productForm,enabled:e.target.checked})} /> نمایش محصول در کاتالوگ عمومی</label>
            <div className="editor-actions"><button className="button button-primary" disabled={savingProduct}>{savingProduct ? "در حال ذخیره…" : productForm.id ? "ذخیره تغییرات" : "ایجاد محصول"}</button></div>
          </form>
          <div className="table-wrap"><table><thead><tr><th>محصول</th><th>ارزش کارت</th><th>قیمت فروش</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
            {products.length ? products.map(product => <tr key={product.id}><td><strong>{product.name}</strong><small className="sub-cell">{product.providerProductId || "Tremendous"}</small></td><td dir="ltr">{money(product.faceValueMinor)}</td><td dir="ltr">{money(product.salePriceMinor)}</td><td><span className={product.enabled ? "pill pill-on" : "pill"}>{product.enabled ? "فعال" : "غیرفعال"}</span></td><td className="row-actions"><button className="text-button" onClick={() => editProduct(product)}>ویرایش</button>{Boolean(product.enabled) && <button className="text-button danger-text" onClick={() => void disableProduct(product)}>غیرفعال‌سازی</button>}</td></tr>) : <tr><td colSpan={5} className="empty-cell">هنوز محصولی ثبت نشده است.</td></tr>}
          </tbody></table></div>
          <p className="admin-note">محصولات جدید به‌صورت پیش‌فرض غیرفعال‌اند. فعال‌سازی فقط پس از تأیید شناسه و شرایط محصول در حساب ارائه‌دهنده انجام شود.</p>
        </> : <form className="bootstrap-panel" onSubmit={bootstrapOwner} noValidate><h3>تبدیل حساب فعلی به مدیر اصلی</h3><p>این عملیات فقط یک‌بار و زمانی انجام می‌شود که هنوز هیچ مدیری در سامانه وجود نداشته باشد. ایمیل حساب فعال فعلی استفاده می‌شود.</p><label>کلید راه‌اندازی مدیر<div className="password-wrap"><input type={showBootstrapToken ? "text" : "password"} value={bootstrapToken} onChange={e => setBootstrapToken(e.target.value)} autoComplete="off" dir="ltr" /><button type="button" className="reveal" onClick={() => setShowBootstrapToken(v => !v)} aria-label={showBootstrapToken ? "مخفی کردن کلید" : "نمایش کلید"}>{showBootstrapToken ? "مخفی" : "نمایش"}</button></div></label><button className="button button-primary" disabled={busy || !bootstrapToken}>فعال‌سازی مدیر اصلی</button></form>}
      </section> : bootstrapAvailable ? <section className="admin-section"><div className="section-heading"><div><div className="kicker"><span /> FIRST ADMIN</div><h2>راه‌اندازی مدیر اصلی</h2></div></div><form className="bootstrap-panel" onSubmit={bootstrapOwner} noValidate><h3>تبدیل حساب فعلی به مدیر اصلی</h3><p>هنوز مدیری برای سامانه ساخته نشده است. با کلید یک‌بارمصرف Cloudflare می‌توانید حساب تأییدشده خود را به مدیر اصلی تبدیل کنید.</p><label>کلید راه‌اندازی مدیر<input type={showBootstrapToken ? "text" : "password"} value={bootstrapToken} onChange={e => setBootstrapToken(e.target.value)} autoComplete="off" dir="ltr" /><button type="button" className="reveal bootstrap-reveal" onClick={() => setShowBootstrapToken(v => !v)} aria-label={showBootstrapToken ? "مخفی کردن کلید" : "نمایش کلید"}>{showBootstrapToken ? "مخفی" : "نمایش"}</button></label><button className="button button-primary" disabled={busy || !bootstrapToken}>فعال‌سازی مدیر اصلی</button></form></section> : <section className="catalog-section"><div className="section-heading"><div><div className="kicker"><span /> AVAILABLE CARDS</div><h2>کارت‌های قابل سفارش</h2></div><span className="muted-count">{products.length.toLocaleString("fa-IR")} محصول</span></div>
        {products.length ? <div className="catalog-grid">{products.map(product => <article className="catalog-card" key={product.id}><div className="mini-card"><span>VISA</span><small>PREPAID</small></div><h3>{product.name}</h3><p>{product.description || "کارت مجازی پیش‌پرداخت"}</p><div className="price-row"><span>ارزش کارت</span><b>{money(product.faceValueMinor)}</b></div><div className="price-row sale-price"><span>قیمت</span><b>{money(product.salePriceMinor)}</b></div><span className="coming-soon">سفارش‌دهی به‌زودی فعال می‌شود</span></article>)}</div> : <div className="empty-state"><div className="empty-symbol">V</div><h3>فعلاً محصولی برای نمایش وجود ندارد</h3><p>پس از تأیید محصولات توسط ارائه‌دهنده، کاتالوگ اینجا نمایش داده می‌شود.</p></div>}
      </section>}
    </section>}
    <footer className="footer"><span>VISA PREPAID PLATFORM</span><span>پرداخت و صدور کارت تابع شرایط ارائه‌دهنده است.</span></footer>
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
