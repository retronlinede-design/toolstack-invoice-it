import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Invoice-It (Styled to match Check-It master)
 * - bg-neutral-50 page, white cards, neutral borders
 * - Normalized Top Actions grid + pinned ? Help (Help Pack v1)
 * - Print Preview modal (prints ONLY invoice sheet)
 * - Export/Import JSON + Export CSV
 * - Autosave to localStorage
 */

const LS_KEY = "toolstack_invoiceit_v1";

const uid = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const safeParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const toNumber = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (iso, days) => {
  try {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
};

const money = (value, currency = "EUR") => {
  const v = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${sign}${currency} ${abs.toFixed(2)}`;
  }
};

/** Master UI primitives (Check-It) */
const btnSecondary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white shadow-sm hover:bg-neutral-600 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnDanger =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";

const inputBase =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";

const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardHead = "px-4 py-3 border-b border-neutral-100";
const cardPad = "p-4";

function SmallButton({ children, onClick, tone = "default", className = "", disabled, title, type }) {
  const cls = tone === "primary" ? btnPrimary : tone === "danger" ? btnDanger : btnSecondary;
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${cls} ${className}`}
    >
      {children}
    </button>
  );
}

/** Normalized Top Actions (mobile-aligned grid) */
const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-700"
      : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200";
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${ACTION_BASE} ${cls}`}>
      {children}
    </button>
  );
}

function ActionFileButton({ children, onFile, accept = "application/json", tone = "primary", title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-700"
      : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200";

  return (
    <label title={title} className={`${ACTION_BASE} ${cls} cursor-pointer`}>
      <span>{children}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile?.(e.target.files?.[0] || null)}
      />
    </label>
  );
}

/** Help Pack v1 (modal) */
function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-neutral-800">Help</div>
            <div className="text-sm text-neutral-700 mt-1">How saving works in ToolStack apps.</div>
            <div className="mt-3 h-[2px] w-52 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-neutral-700">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Autosave (default)</div>
            <p className="mt-1 text-neutral-700">
              Your data saves automatically in this browser on this device (localStorage). If you clear browser data or
              switch devices, it won’t follow automatically.
            </p>
            <div className="mt-2 text-xs text-neutral-600">
              Storage key: <span className="font-mono">{LS_KEY}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Export (backup / move devices)</div>
            <p className="mt-1 text-neutral-700">
              Use <span className="font-medium">Export</span> to download a JSON backup file. Save it somewhere safe
              (Drive/Dropbox/email to yourself).
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Import (restore)</div>
            <p className="mt-1 text-neutral-700">
              Use <span className="font-medium">Import</span> to load a previous JSON backup and continue.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Printing invoices</div>
            <p className="mt-1 text-neutral-700">
              Use <span className="font-medium">Preview</span> first, then <span className="font-medium">Print / Save PDF</span>.
              This prints only the invoice sheet.
            </p>
          </div>

          <div className="text-xs text-neutral-600">Tip: Export once a week (or after big updates) so you always have a clean backup.</div>
        </div>

        <div className="p-4 border-t border-neutral-100 flex items-center justify-end">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS = ["Draft", "Sent", "Paid", "Overdue"];

function calcTotals(inv) {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const net = items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.unitPrice), 0);
  const vatRate = toNumber(inv.vatRate);
  const vat = net * (vatRate / 100);
  const gross = net + vat;
  return { net, vatRate, vat, gross };
}

function normalizeData(raw) {
  const base = {
    settings: {
      currency: "EUR",
      defaultVatRate: 19,
      invoicePrefix: "INV",
      nextInvoiceNumber: 1,
      defaultDueDays: 14,
    },
    profile: {
      businessName: "",
      address: "",
      email: "",
      phone: "",
      taxId: "",
      vatId: "",
      bank: "",
      iban: "",
      bic: "",
      footerNotes: "",
    },
    clients: [],
    invoices: [],
  };

  const d = raw && typeof raw === "object" ? raw : base;
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.profile = { ...base.profile, ...(d.profile || {}) };
  d.clients = Array.isArray(d.clients) ? d.clients : [];
  d.invoices = Array.isArray(d.invoices) ? d.invoices : [];

  d.invoices = d.invoices.map((inv) => ({
    id: inv.id || uid(),
    invoiceNumber: inv.invoiceNumber || "",
    issueDate: inv.issueDate || todayISO(),
    dueDate: inv.dueDate || addDaysISO(inv.issueDate || todayISO(), d.settings.defaultDueDays),
    clientId: inv.clientId || "",
    status: STATUS.includes(inv.status) ? inv.status : "Draft",
    vatRate: Number.isFinite(toNumber(inv.vatRate)) ? toNumber(inv.vatRate) : d.settings.defaultVatRate,
    items: Array.isArray(inv.items)
      ? inv.items.map((it) => ({
          id: it.id || uid(),
          desc: it.desc || "",
          qty: Number.isFinite(toNumber(it.qty)) ? toNumber(it.qty) : 1,
          unit: it.unit || "",
          unitPrice: Number.isFinite(toNumber(it.unitPrice)) ? toNumber(it.unitPrice) : 0,
        }))
      : [{ id: uid(), desc: "", qty: 1, unit: "", unitPrice: 0 }],
    notes: typeof inv.notes === "string" ? inv.notes : "",
  }));

  d.clients = d.clients.map((c) => ({
    id: c.id || uid(),
    name: c.name || "",
    address: c.address || "",
    email: c.email || "",
    phone: c.phone || "",
    contact: c.contact || "",
    notes: c.notes || "",
  }));

  return d;
}

export default function InvoiceItApp() {
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  const [helpOpen, setHelpOpen] = useState(false);

  const [app, setApp] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    return normalizeData(saved ? safeParse(saved, null) : null);
  });

  const [toast, setToast] = useState(null);
  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(app));
  }, [app]);

  const currency = app.settings.currency || "EUR";

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [editingClientId, setEditingClientId] = useState(null); // null or id or "__new__"

  const clientsById = useMemo(() => {
    const m = new Map();
    for (const c of app.clients) m.set(c.id, c);
    return m;
  }, [app.clients]);

  const activeInvoice = useMemo(
    () => app.invoices.find((x) => x.id === activeInvoiceId) || null,
    [app.invoices, activeInvoiceId]
  );

  const totalsByStatus = useMemo(() => {
    const base = { Draft: 0, Sent: 0, Paid: 0, Overdue: 0 };
    for (const inv of app.invoices) {
      const t = calcTotals(inv);
      base[inv.status] = (base[inv.status] || 0) + t.gross;
    }
    return base;
  }, [app.invoices]);

  const filteredInvoices = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return app.invoices
      .filter((inv) => {
        if (statusFilter !== "All" && inv.status !== statusFilter) return false;
        if (!needle) return true;
        const client = clientsById.get(inv.clientId);
        const blob = [
          inv.invoiceNumber,
          inv.issueDate,
          inv.dueDate,
          inv.status,
          client?.name,
          client?.email,
          inv.notes,
          ...(inv.items || []).map((i) => i.desc),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      })
      .sort((a, b) => String(b.issueDate || "").localeCompare(String(a.issueDate || "")));
  }, [app.invoices, q, statusFilter, clientsById]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(app, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-invoiceit-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify("Exported");
  };

  const importJSON = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed || (!parsed.clients && !parsed.invoices && !parsed.settings)) {
      notify("Invalid JSON");
      return;
    }
    setApp(normalizeData(parsed));
    setActiveInvoiceId(null);
    notify("Imported");
  };

  const exportCSV = () => {
    const header = ["invoiceNumber", "issueDate", "dueDate", "client", "status", "net", "vatRate", "vat", "gross", "currency"];

    const rows = app.invoices
      .slice()
      .sort((a, b) => String(b.issueDate || "").localeCompare(String(a.issueDate || "")))
      .map((inv) => {
        const client = clientsById.get(inv.clientId);
        const t = calcTotals(inv);
        const vals = {
          invoiceNumber: inv.invoiceNumber || "",
          issueDate: inv.issueDate || "",
          dueDate: inv.dueDate || "",
          client: client?.name || "",
          status: inv.status || "",
          net: t.net.toFixed(2),
          vatRate: String(t.vatRate),
          vat: t.vat.toFixed(2),
          gross: t.gross.toFixed(2),
          currency,
        };
        return header.map((k) => vals[k]);
      });

    const esc = (v) => {
      const s = String(v ?? "");
      return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [header.join(","), ...rows.map((r) => r.map(esc).join(","))];
    const csv = lines.join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-invoiceit-invoices-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify("CSV exported");
  };

  const createInvoice = () => {
    setApp((a) => {
      const n = Math.max(1, toNumber(a.settings.nextInvoiceNumber));
      const prefix = String(a.settings.invoicePrefix || "INV").trim() || "INV";
      const issueDate = todayISO();
      const dueDate = addDaysISO(issueDate, toNumber(a.settings.defaultDueDays) || 14);
      const invoiceNumber = `${prefix}-${String(n).padStart(4, "0")}`;

      const inv = {
        id: uid(),
        invoiceNumber,
        issueDate,
        dueDate,
        clientId: "",
        status: "Draft",
        vatRate: toNumber(a.settings.defaultVatRate),
        items: [{ id: uid(), desc: "", qty: 1, unit: "", unitPrice: 0 }],
        notes: "",
      };

      // UI open
      setActiveInvoiceId(inv.id);
      setInvoiceModalOpen(true);

      return {
        ...a,
        settings: { ...a.settings, nextInvoiceNumber: n + 1 },
        invoices: [inv, ...(a.invoices || [])],
      };
    });
  };

  const duplicateInvoice = (id) => {
    setApp((a) => {
      const src = a.invoices.find((x) => x.id === id);
      if (!src) return a;
      const n = Math.max(1, toNumber(a.settings.nextInvoiceNumber));
      const prefix = String(a.settings.invoicePrefix || "INV").trim() || "INV";
      const invoiceNumber = `${prefix}-${String(n).padStart(4, "0")}`;

      const copy = {
        ...src,
        id: uid(),
        invoiceNumber,
        status: "Draft",
        issueDate: todayISO(),
        dueDate: addDaysISO(todayISO(), toNumber(a.settings.defaultDueDays) || 14),
        items: (src.items || []).map((it) => ({ ...it, id: uid() })),
      };

      notify("Duplicated");
      return {
        ...a,
        settings: { ...a.settings, nextInvoiceNumber: n + 1 },
        invoices: [copy, ...(a.invoices || [])],
      };
    });
  };

  const deleteInvoice = (id) => {
    const ok = window.confirm("Delete this invoice?");
    if (!ok) return;
    setApp((a) => ({ ...a, invoices: (a.invoices || []).filter((x) => x.id !== id) }));
    if (activeInvoiceId === id) setActiveInvoiceId(null);
    notify("Deleted");
  };

  const upsertInvoice = (patch) => {
    setApp((a) => ({
      ...a,
      invoices: (a.invoices || []).map((x) => (x.id === patch.id ? { ...x, ...patch } : x)),
    }));
  };

  const upsertClient = (client) => {
    setApp((a) => {
      const list = [...(a.clients || [])];
      const idx = list.findIndex((c) => c.id === client.id);
      if (idx >= 0) list[idx] = client;
      else list.unshift(client);
      return { ...a, clients: list };
    });
  };

  const deleteClient = (id) => {
    const c = app.clients.find((x) => x.id === id);
    const name = (c?.name || "this client").trim();
    const ok = window.confirm(`Delete “${name}”? Invoices will keep but client will be blank.`);
    if (!ok) return;

    setApp((a) => {
      const invoices = (a.invoices || []).map((inv) => (inv.clientId === id ? { ...inv, clientId: "" } : inv));
      return { ...a, clients: (a.clients || []).filter((x) => x.id !== id), invoices };
    });

    notify("Client deleted");
  };

  /** Print/Save PDF should print ONLY invoice sheet -> open preview then print */
  const printInvoicePDF = () => {
    if (!activeInvoice) return;
    setPreviewOpen(true);
    // small delay so CSS kicks in
    setTimeout(() => window.print(), 80);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      {/* Print rules */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>

      {/* When preview is open, print only the preview sheet */}
      {previewOpen ? (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #invoice-print-preview, #invoice-print-preview * { visibility: visible !important; }
            #invoice-print-preview { position: absolute !important; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      ) : null}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Print Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />

          <div className="relative w-full max-w-5xl">
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-neutral-800">Print preview</div>
              <div className="flex items-center gap-2">
                <button className={btnSecondary} onClick={() => window.print()}>
                  Print / Save PDF
                </button>
                <button className={btnPrimary} onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="invoice-print-preview" className="p-6">
                {activeInvoice ? (
                  <InvoiceSheet
                    profile={app.profile}
                    invoice={activeInvoice}
                    client={clientsById.get(activeInvoice.clientId) || null}
                    currency={currency}
                  />
                ) : (
                  <div className="text-sm text-neutral-600">Select an invoice first.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-700">
              <span>Invoice</span>
              <span className="text-lime-500">It</span>
            </div>
            <div className="text-sm text-neutral-700">Clients, invoices, preview, and exports.</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>

          {/* Normalized Top Actions (Preview / Print / Export / Import) + pinned Help */}
          <div className="w-full sm:w-[680px]">
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pr-12">
                <ActionButton
                  onClick={() => setPreviewOpen(true)}
                  disabled={!activeInvoice}
                  title={!activeInvoice ? "Select an invoice first" : ""}
                >
                  Preview
                </ActionButton>
                <ActionButton
                  onClick={printInvoicePDF}
                  disabled={!activeInvoice}
                  title={!activeInvoice ? "Select an invoice first" : "Print only the invoice sheet"}
                >
                  Print / Save PDF
                </ActionButton>
                <ActionButton onClick={exportJSON}>Export</ActionButton>
                <ActionFileButton
                  onFile={(f) => importJSON(f)}
                  tone="primary"
                  title="Import a JSON backup"
                >
                  Import
                </ActionFileButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className="print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 shadow-sm flex items-center justify-center font-bold text-neutral-800"
                aria-label="Help"
              >
                ?
              </button>
            </div>

            {/* App-specific quick actions (kept separate so Top Actions stays consistent) */}
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              <SmallButton onClick={exportCSV}>Export CSV</SmallButton>
              <SmallButton tone="primary" onClick={createInvoice}>
                + New invoice
              </SmallButton>
              <SmallButton
                onClick={() => {
                  setEditingClientId("__new__");
                  setClientModalOpen(true);
                }}
              >
                + Client
              </SmallButton>
              <SmallButton onClick={() => setSettingsOpen(true)}>Settings</SmallButton>
            </div>
          </div>
        </div>

        {/* Totals row */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          {(["Draft", "Sent", "Paid", "Overdue"]).map((s) => (
            <div key={s} className={`${card} print:shadow-none`}>
              <div className={cardHead}>
                <div className="font-semibold text-neutral-800">{s}</div>
              </div>
              <div className={cardPad}>
                <div className="text-2xl font-semibold text-neutral-800">{money(totalsByStatus[s], currency)}</div>
                <div className="text-xs text-neutral-600 mt-1">Gross total</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`${card} md:col-span-2`}>
            <div className={`${cardHead} flex items-center justify-between gap-3`}>
              <div className="font-semibold text-neutral-800">Search</div>
              <div className="text-sm text-neutral-600">{filteredInvoices.length} shown</div>
            </div>
            <div className={`${cardPad} grid grid-cols-1 md:grid-cols-2 gap-3`}>
              <input
                className={inputBase}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search invoices (client, number, items, notes…)"
              />
              <select
                className={inputBase}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All statuses</option>
                {STATUS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={card}>
            <div className={cardHead}>
              <div className="font-semibold text-neutral-800">Currency</div>
            </div>
            <div className={cardPad}>
              <select
                className={inputBase}
                value={app.settings.currency}
                onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, currency: e.target.value } }))}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Clients */}
          <div className={card}>
            <div className={`${cardHead} flex items-center justify-between`}>
              <div className="font-semibold text-neutral-800">Clients</div>
              <SmallButton
                tone="primary"
                onClick={() => {
                  setEditingClientId("__new__");
                  setClientModalOpen(true);
                }}
              >
                + Add
              </SmallButton>
            </div>
            <div className={`${cardPad} space-y-2`}>
              {app.clients.length === 0 ? (
                <div className="text-sm text-neutral-600">No clients yet.</div>
              ) : (
                app.clients
                  .slice()
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((c) => (
                    <div key={c.id} className="rounded-2xl border border-neutral-200">
                      <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-800 truncate">{c.name || "(unnamed)"}</div>
                          <div className="text-xs text-neutral-600 truncate">{c.email || ""}</div>
                        </div>
                        <div className="text-xs text-neutral-600">
                          {app.invoices.filter((i) => i.clientId === c.id).length} inv
                        </div>
                      </div>
                      <div className="p-3 flex items-center gap-2">
                        <SmallButton
                          onClick={() => {
                            setEditingClientId(c.id);
                            setClientModalOpen(true);
                          }}
                        >
                          Edit
                        </SmallButton>
                        <SmallButton tone="danger" onClick={() => deleteClient(c.id)}>
                          Delete
                        </SmallButton>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Invoices list */}
          <div className="md:col-span-2 rounded-2xl bg-white shadow-sm border border-neutral-200">
            <div className={`${cardHead} flex items-center justify-between`}>
              <div className="font-semibold text-neutral-800">Invoices</div>
              <SmallButton tone="primary" onClick={createInvoice}>
                + New
              </SmallButton>
            </div>

            <div className="p-4 overflow-auto">
              {filteredInvoices.length === 0 ? (
                <div className="text-sm text-neutral-600">No invoices match your filters.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Invoice</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Client</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Dates</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Total</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const client = clientsById.get(inv.clientId);
                      const t = calcTotals(inv);
                      const selected = inv.id === activeInvoiceId;
                      return (
                        <tr key={inv.id} className={`border-t border-neutral-200 ${selected ? "bg-lime-50" : ""}`}>
                          <td className="px-3 py-2">
                            <button className="text-left" onClick={() => setActiveInvoiceId(inv.id)} title="Select">
                              <div className="font-semibold text-neutral-800">{inv.invoiceNumber || "(no number)"}</div>
                              <div className="text-xs text-neutral-600">VAT: {toNumber(inv.vatRate)}%</div>
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-neutral-800">{client?.name || "—"}</div>
                            <div className="text-xs text-neutral-600">{client?.email || ""}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs text-neutral-600">
                              Issue: <span className="text-neutral-800">{inv.issueDate}</span>
                            </div>
                            <div className="text-xs text-neutral-600">
                              Due: <span className="text-neutral-800">{inv.dueDate}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className={inputBase}
                              value={inv.status}
                              onChange={(e) => upsertInvoice({ id: inv.id, status: e.target.value })}
                            >
                              {STATUS.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-neutral-800">{money(t.gross, currency)}</div>
                            <div className="text-xs text-neutral-600">Net {money(t.net, currency)}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 justify-end">
                              <SmallButton onClick={() => { setActiveInvoiceId(inv.id); setInvoiceModalOpen(true); }}>
                                Edit
                              </SmallButton>
                              <SmallButton onClick={() => duplicateInvoice(inv.id)}>Duplicate</SmallButton>
                              <SmallButton tone="danger" onClick={() => deleteInvoice(inv.id)}>Delete</SmallButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm text-neutral-600">
                  {activeInvoice ? (
                    <>
                      Selected: <span className="font-semibold text-neutral-800">{activeInvoice.invoiceNumber}</span>
                      {" · "}
                      <span className="text-neutral-800">{clientsById.get(activeInvoice.clientId)?.name || "No client"}</span>
                    </>
                  ) : (
                    "Select an invoice to preview."
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SmallButton onClick={() => setPreviewOpen(true)} disabled={!activeInvoice}>
                    Preview
                  </SmallButton>
                  <SmallButton onClick={() => setInvoiceModalOpen(true)} disabled={!activeInvoice}>
                    Open editor
                  </SmallButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-800 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}
      </div>

      {/* Settings modal */}
      {settingsOpen ? (
        <ModalLight title="Settings" onClose={() => setSettingsOpen(false)}>
          <SettingsPanel app={app} setApp={setApp} notify={notify} />
        </ModalLight>
      ) : null}

      {/* Client modal */}
      {clientModalOpen ? (
        <ClientModal
          open={clientModalOpen}
          onClose={() => setClientModalOpen(false)}
          clientId={editingClientId}
          clients={app.clients}
          onSave={(c) => {
            upsertClient(c);
            setClientModalOpen(false);
            notify("Saved");
          }}
        />
      ) : null}

      {/* Invoice modal */}
      {invoiceModalOpen ? (
        <InvoiceModal
          open={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={activeInvoice}
          clients={app.clients}
          currency={currency}
          defaultVat={app.settings.defaultVatRate}
          onSave={(inv) => {
            upsertInvoice(inv);
            setInvoiceModalOpen(false);
            notify("Saved");
          }}
        />
      ) : null}
    </div>
  );
}

function ModalLight({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl">
        <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-neutral-800">{title}</div>
          <button className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ app, setApp, notify }) {
  const s = app.settings;
  const p = app.profile;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">Invoice defaults</div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs font-medium text-neutral-700">Invoice prefix</div>
            <input
              className={`mt-1 ${inputBase}`}
              value={s.invoicePrefix}
              onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, invoicePrefix: e.target.value } }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-700">Next invoice number</div>
            <input
              type="number"
              className={`mt-1 ${inputBase}`}
              value={s.nextInvoiceNumber}
              onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, nextInvoiceNumber: toNumber(e.target.value) || 1 } }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-700">Default VAT rate (%)</div>
            <input
              type="number"
              className={`mt-1 ${inputBase}`}
              value={s.defaultVatRate}
              onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, defaultVatRate: toNumber(e.target.value) } }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-700">Default due days</div>
            <input
              type="number"
              className={`mt-1 ${inputBase}`}
              value={s.defaultDueDays}
              onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, defaultDueDays: toNumber(e.target.value) || 14 } }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-700">Currency</div>
            <select
              className={`mt-1 ${inputBase}`}
              value={s.currency}
              onChange={(e) => setApp((a) => ({ ...a, settings: { ...a.settings, currency: e.target.value } }))}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">Business profile</div>
        <div className="p-4 space-y-3">
          <Field label="Business name" value={p.businessName} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, businessName: v } }))} />
          <Field label="Email" value={p.email} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, email: v } }))} />
          <Field label="Phone" value={p.phone} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, phone: v } }))} />
          <TextArea label="Address" value={p.address} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, address: v } }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Tax ID" value={p.taxId} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, taxId: v } }))} />
            <Field label="VAT ID" value={p.vatId} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, vatId: v } }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Bank" value={p.bank} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, bank: v } }))} />
            <Field label="IBAN" value={p.iban} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, iban: v } }))} />
          </div>
          <Field label="BIC" value={p.bic} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, bic: v } }))} />
          <TextArea label="Footer notes" value={p.footerNotes} onChange={(v) => setApp((a) => ({ ...a, profile: { ...a.profile, footerNotes: v } }))} />

          <div className="pt-2">
            <SmallButton tone="primary" onClick={() => notify("Saved")}>Save</SmallButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-neutral-700">{label}</div>
      <input
        className={`mt-1 ${inputBase}`}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-neutral-700">{label}</div>
      <textarea
        className={`mt-1 ${inputBase} min-h-[90px]`}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

/** FIXED: Hooks are always called; we only return null after hooks */
function ClientModal({ open, onClose, clientId, clients, onSave }) {
  const existing = useMemo(() => clients.find((c) => c.id === clientId) || null, [clients, clientId]);
  const isNew = clientId === "__new__" || !existing;

  const makeBlank = () => ({
    id: uid(),
    name: "",
    address: "",
    email: "",
    phone: "",
    contact: "",
    notes: "",
  });

  const [draft, setDraft] = useState(() => existing || makeBlank());

  useEffect(() => {
    if (!open) return;
    setDraft(existing || makeBlank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, existing?.id]);

  if (!open) return null;

  return (
    <ModalLight title={isNew ? "New client" : "Edit client"} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Field label="Client name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
        </div>
        <Field label="Email" value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} />
        <Field label="Phone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
        <div className="md:col-span-2">
          <TextArea label="Address" value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} />
        </div>
        <div className="md:col-span-2">
          <Field label="Contact person (optional)" value={draft.contact} onChange={(v) => setDraft((d) => ({ ...d, contact: v }))} />
        </div>
        <div className="md:col-span-2">
          <TextArea label="Notes (optional)" value={draft.notes} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} />
        </div>

        <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <SmallButton
            tone="primary"
            onClick={() => {
              if (!String(draft.name || "").trim()) return alert("Client name is required");
              onSave?.({ ...draft, name: String(draft.name || "").trim() });
            }}
          >
            Save
          </SmallButton>
        </div>
      </div>
    </ModalLight>
  );
}

/** FIXED: Hooks always called; safe fallback when invoice is null */
function InvoiceModal({ open, onClose, invoice, clients, currency, defaultVat, onSave }) {
  const base = useMemo(() => {
    if (!invoice) {
      return {
        id: "",
        invoiceNumber: "",
        issueDate: todayISO(),
        dueDate: addDaysISO(todayISO(), 14),
        clientId: "",
        status: "Draft",
        vatRate: toNumber(defaultVat),
        items: [{ id: uid(), desc: "", qty: 1, unit: "", unitPrice: 0 }],
        notes: "",
      };
    }
    return {
      ...invoice,
      vatRate: toNumber(invoice.vatRate) || toNumber(defaultVat),
      items: (invoice.items || []).map((it) => ({
        ...it,
        qty: toNumber(it.qty) || 0,
        unitPrice: toNumber(it.unitPrice) || 0,
      })),
    };
  }, [invoice, defaultVat]);

  const [draft, setDraft] = useState(() => base);

  useEffect(() => {
    if (!open) return;
    setDraft(base);
  }, [open, base]);

  if (!open) return null;

  if (!invoice) {
    return (
      <ModalLight title="Invoice" onClose={onClose}>
        <div className="text-sm text-neutral-600">No invoice selected.</div>
      </ModalLight>
    );
  }

  const totals = calcTotals(draft);

  const setItem = (id, patch) => {
    setDraft((d) => ({
      ...d,
      items: (d.items || []).map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  };

  const addItem = () =>
    setDraft((d) => ({
      ...d,
      items: [...(d.items || []), { id: uid(), desc: "", qty: 1, unit: "", unitPrice: 0 }],
    }));

  const delItem = (id) =>
    setDraft((d) => ({ ...d, items: (d.items || []).filter((it) => it.id !== id) }));

  return (
    <ModalLight title={`Edit invoice — ${draft.invoiceNumber}`} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-xs font-medium text-neutral-700">Issue date</div>
          <input
            type="date"
            className={`mt-1 ${inputBase}`}
            value={draft.issueDate || ""}
            onChange={(e) => setDraft((d) => ({ ...d, issueDate: e.target.value }))}
          />
        </label>

        <label className="block">
          <div className="text-xs font-medium text-neutral-700">Due date</div>
          <input
            type="date"
            className={`mt-1 ${inputBase}`}
            value={draft.dueDate || ""}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
          />
        </label>

        <label className="block md:col-span-2">
          <div className="text-xs font-medium text-neutral-700">Client</div>
          <select
            className={`mt-1 ${inputBase}`}
            value={draft.clientId || ""}
            onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
          >
            <option value="">— Select client —</option>
            {clients
              .slice()
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs font-medium text-neutral-700">Status</div>
          <select
            className={`mt-1 ${inputBase}`}
            value={draft.status || "Draft"}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs font-medium text-neutral-700">VAT rate (%)</div>
          <input
            type="number"
            className={`mt-1 ${inputBase}`}
            value={draft.vatRate}
            onChange={(e) => setDraft((d) => ({ ...d, vatRate: e.target.value }))}
          />
        </label>

        <div className="md:col-span-2 rounded-2xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <div className="font-semibold text-neutral-800">Line items</div>
            <SmallButton tone="primary" onClick={addItem}>
              + Add item
            </SmallButton>
          </div>

          <div className="p-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Unit price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(draft.items || []).length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-neutral-600" colSpan={6}>
                      No items.
                    </td>
                  </tr>
                ) : (
                  (draft.items || []).map((it) => {
                    const line = toNumber(it.qty) * toNumber(it.unitPrice);
                    return (
                      <tr key={it.id} className="border-t border-neutral-200">
                        <td className="px-3 py-2">
                          <input
                            className={inputBase}
                            value={it.desc || ""}
                            onChange={(e) => setItem(it.id, { desc: e.target.value })}
                            placeholder="Service / Product"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={inputBase}
                            value={it.qty ?? 0}
                            onChange={(e) => setItem(it.id, { qty: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputBase}
                            value={it.unit || ""}
                            onChange={(e) => setItem(it.id, { unit: e.target.value })}
                            placeholder="hrs / pcs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={inputBase}
                            value={it.unitPrice ?? 0}
                            onChange={(e) => setItem(it.id, { unitPrice: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-neutral-800">{money(line, currency)}</td>
                        <td className="px-3 py-2">
                          <SmallButton tone="danger" onClick={() => delItem(it.id)}>
                            Remove
                          </SmallButton>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 rounded-2xl border border-neutral-200">
            <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">Notes</div>
            <div className="p-4">
              <textarea
                className={`${inputBase} min-h-[90px]`}
                value={draft.notes || ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Payment terms, reference, etc."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200">
            <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">Totals</div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600">Net</div>
                <div className="font-semibold text-neutral-800">{money(totals.net, currency)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600">VAT ({totals.vatRate}%)</div>
                <div className="font-semibold text-neutral-800">{money(totals.vat, currency)}</div>
              </div>
              <div className="pt-2 mt-2 border-t border-neutral-200 flex items-center justify-between">
                <div className="font-semibold text-neutral-800">Total</div>
                <div className="text-lg font-semibold text-neutral-800">{money(totals.gross, currency)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <SmallButton
            tone="primary"
            onClick={() => {
              onSave?.({
                ...draft,
                vatRate: toNumber(draft.vatRate),
                items: (draft.items || []).map((it) => ({
                  ...it,
                  qty: toNumber(it.qty),
                  unitPrice: toNumber(it.unitPrice),
                })),
              });
            }}
          >
            Save
          </SmallButton>
        </div>
      </div>
    </ModalLight>
  );
}

function InvoiceSheet({ profile, invoice, client, currency }) {
  const t = calcTotals(invoice);
  const now = new Date().toLocaleString();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-neutral-800">Invoice</div>
          <div className="text-sm text-neutral-700">Generated: {now}</div>
          <div className="mt-3 h-[2px] w-64 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
          <div className="flex items-center justify-between gap-6">
            <span className="text-neutral-600">Invoice #</span>
            <span className="font-semibold text-neutral-800">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-6 mt-1">
            <span className="text-neutral-600">Issue</span>
            <span className="font-semibold text-neutral-800">{invoice.issueDate}</span>
          </div>
          <div className="flex items-center justify-between gap-6 mt-1">
            <span className="text-neutral-600">Due</span>
            <span className="font-semibold text-neutral-800">{invoice.dueDate}</span>
          </div>
          <div className="flex items-center justify-between gap-6 mt-1">
            <span className="text-neutral-600">Status</span>
            <span className="font-semibold text-neutral-800">{invoice.status}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">From</div>
          <div className="p-4 text-sm text-neutral-700">
            <div className="font-semibold text-neutral-800">{profile.businessName || "Your Business"}</div>
            <div className="whitespace-pre-line">{profile.address || ""}</div>
            {profile.email ? <div>{profile.email}</div> : null}
            {profile.phone ? <div>{profile.phone}</div> : null}
            {profile.taxId ? (
              <div className="mt-2">
                <span className="font-semibold">Tax ID:</span> {profile.taxId}
              </div>
            ) : null}
            {profile.vatId ? (
              <div>
                <span className="font-semibold">VAT ID:</span> {profile.vatId}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-800">Bill To</div>
          <div className="p-4 text-sm text-neutral-700">
            <div className="font-semibold text-neutral-800">{client?.name || "—"}</div>
            <div className="whitespace-pre-line">{client?.address || ""}</div>
            {client?.email ? <div>{client.email}</div> : null}
            {client?.phone ? <div>{client.phone}</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Description</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Unit</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Unit price</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((it) => {
              const line = toNumber(it.qty) * toNumber(it.unitPrice);
              return (
                <tr key={it.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2">{it.desc || "—"}</td>
                  <td className="px-3 py-2">{toNumber(it.qty)}</td>
                  <td className="px-3 py-2">{it.unit || ""}</td>
                  <td className="px-3 py-2">{money(toNumber(it.unitPrice), currency)}</td>
                  <td className="px-3 py-2 font-semibold text-neutral-800">{money(line, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-700 whitespace-pre-line">
          {invoice.notes || ""}
          {invoice.notes && profile.footerNotes ? "\n\n" : ""}
          {profile.footerNotes || ""}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Net</span>
            <span className="font-semibold text-neutral-800">{money(t.net, currency)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-neutral-600">VAT ({t.vatRate}%)</span>
            <span className="font-semibold text-neutral-800">{money(t.vat, currency)}</span>
          </div>
          <div className="pt-3 mt-3 border-t border-neutral-200 flex items-center justify-between">
            <span className="font-semibold text-neutral-800">Total</span>
            <span className="text-lg font-semibold text-neutral-800">{money(t.gross, currency)}</span>
          </div>

          {profile.bank || profile.iban || profile.bic ? (
            <div className="mt-4 text-neutral-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payment</div>
              {profile.bank ? (
                <div>
                  <span className="font-semibold">Bank:</span> {profile.bank}
                </div>
              ) : null}
              {profile.iban ? (
                <div>
                  <span className="font-semibold">IBAN:</span> {profile.iban}
                </div>
              ) : null}
              {profile.bic ? (
                <div>
                  <span className="font-semibold">BIC:</span> {profile.bic}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-600">ToolStack • Invoice-It</div>
    </div>
  );
}
