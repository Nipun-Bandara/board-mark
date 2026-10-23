"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Download, Droplets,
  Edit3, Home, LogIn, LogOut, Menu, Moon, Plus, Settings2,
  Trash2, Upload, X, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  addDays, billableDays, cycleFor, daysBetween, formatCycle, formatDate,
  formatDateTime, fromISO, isStayedOn, localInputToInstant,
  overlapsExisting, toLocalInput, todayISO, totalDays, type Cycle, type Stay
} from "@/lib/dates";
import { normalizeData, readData, STORAGE_KEY, type BillKind, type BoardData } from "@/lib/storage";

type View = "overview" | "stays" | "settings";

function money(value: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${code} ${Math.round(value).toLocaleString()}`;
  }
}

function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`status-pill ${active ? "status-in" : "status-out"}`}><span className="status-dot" />{active ? "Checked in" : "Checked out"}</span>;
}

function BillCard({ kind, days, cycle, rate, currency, onSettings }: {
  kind: BillKind; days: number; cycle: Cycle; rate: number; currency: string; onSettings: () => void;
}) {
  const electric = kind === "electric";
  return <section className={`stat-card bill-card ${electric ? "electric-card" : "water-card"}`}>
    <div className={`stat-icon ${electric ? "stat-icon-amber" : "stat-icon-teal"}`}>{electric ? <Zap size={21} /> : <Droplets size={21} />}</div>
    <span className="stat-label">{electric ? "ELECTRIC" : "WATER"} BILL</span>
    <div className="bill-card-days">{days}<span> {days === 1 ? "day" : "days"}</span></div>
    <p>{formatCycle(cycle)} · starts on the {ordinal(fromISO(cycle.start).getUTCDate())}</p>
    <div className="bill-card-footer"><strong>{rate ? money(days * rate, currency) : "Rate not set"}</strong><button onClick={onSettings} aria-label={`Edit ${kind} rate`}><ArrowUpRight size={17} /></button></div>
  </section>;
}

function CalendarGrid({ cycle, stays, now, today }: { cycle: Cycle; stays: Stay[]; now: string; today: string }) {
  const leading = (fromISO(cycle.start).getUTCDay() + 6) % 7;
  const count = daysBetween(cycle.start, cycle.end);
  const cells = Array.from({ length: leading + count }, (_, index) => index < leading ? null : addDays(cycle.start, index - leading));
  return <div className="calendar-grid" aria-label="Stay dates in selected bill cycle">
    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
    {cells.map((date, index) => date ? <div key={date} className={`calendar-cell ${isStayedOn(stays, date, now) ? "calendar-stayed" : ""} ${date === today ? "calendar-today" : ""} ${date > today ? "calendar-future" : ""}`} title={`${formatDate(date, { weekday: "long", month: "long", day: "numeric" })}${isStayedOn(stays, date, now) ? " · stayed" : ""}`}>
      <span>{fromISO(date).getUTCDate()}</span>
      {date === cycle.start || fromISO(date).getUTCDate() === 1 ? <small>{formatDate(date, { month: "short" })}</small> : null}
      {isStayedOn(stays, date, now) ? <i /> : null}
    </div> : <div className="calendar-empty" key={`empty-${index}`} />)}
  </div>;
}

function StayDialog({ stay, stays, now, onOpenChange, onSave }: {
  stay: Stay | null; stays: Stay[]; now: string;
  onOpenChange: (open: boolean) => void; onSave: (stay: Stay) => void;
}) {
  const [start, setStart] = useState(stay ? toLocalInput(stay.start) : toLocalInput(now));
  const [end, setEnd] = useState(stay?.end ? toLocalInput(stay.end) : "");
  const [note, setNote] = useState(stay?.note ?? "");
  const [error, setError] = useState("");
  const latest = toLocalInput(now);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : undefined;
    const currentTime = new Date().getTime();
    if (!Number.isFinite(startTime) || startTime > currentTime) return setError("Choose a check-in time no later than now.");
    if (end && (!Number.isFinite(endTime) || endTime! <= startTime || endTime! > currentTime)) return setError("Check-out must be after check-in and no later than now.");
    const candidate: Stay = {
      id: stay?.id ?? crypto.randomUUID(), start: localInputToInstant(start),
      ...(end ? { end: localInputToInstant(end) } : {}),
      ...(note.trim() ? { note: note.trim() } : {})
    };
    const current = new Date().toISOString();
    if (overlapsExisting(candidate, stays, current)) return setError("This time overlaps another stay. Edit the existing stay instead.");
    if (!end && stays.some((item) => !item.end && item.id !== candidate.id)) return setError("You already have an open stay. Check out or edit it first.");
    onSave(candidate);
    onOpenChange(false);
  }

  return <Dialog open onOpenChange={onOpenChange}><DialogContent>
    <div className="dialog-icon"><Clock3 size={20} /></div>
    <DialogTitle className="dialog-title">{stay ? "Edit stay" : "Add a stay"}</DialogTitle>
    <DialogDescription className="dialog-description">Record the exact check-in and check-out times. A stay of 12 hours or less counts as 0 days.</DialogDescription>
    <form onSubmit={submit} className="form-stack">
      <div className="field-row">
        <label className="field"><span>Check-in</span><input type="datetime-local" value={start} max={latest} onChange={(event) => setStart(event.target.value)} required /></label>
        <label className="field"><span>Check-out</span><input type="datetime-local" value={end} min={start} max={latest} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <p className="field-help">Leave check-out empty if you are still staying. Longer stays round up to the next full 24-hour day.</p>
      <label className="field"><span>Note <em>optional</em></span><input type="text" value={note} maxLength={100} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Went home for the weekend" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save stay <ArrowRight size={16} /></Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function BoardingDashboard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [now, setNow] = useState("");
  const [view, setView] = useState<View>("overview");
  const [bill, setBill] = useState<BillKind>("electric");
  const [offset, setOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stay | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(readData());
    setNow(new Date().toISOString());
    const interval = window.setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => { if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(""), 4200); return () => window.clearTimeout(timer); } }, [notice]);

  if (!data || !now) return <div className="loading-screen"><div className="brand-mark"><Moon size={23} /></div><span>Loading Boardmark...</span></div>;

  const today = todayISO();
  const electricCycle = cycleFor(today, data.electricDay);
  const waterCycle = cycleFor(today, data.waterDay);
  const currentCycle = bill === "electric" ? electricCycle : waterCycle;
  const selectedCycle = cycleFor(today, bill === "electric" ? data.electricDay : data.waterDay, offset);
  const electricDays = totalDays(data.stays, electricCycle, now);
  const waterDays = totalDays(data.stays, waterCycle, now);
  const selectedDays = totalDays(data.stays, selectedCycle, now);
  const cycleLength = daysBetween(selectedCycle.start, selectedCycle.end);
  const elapsed = Math.min(cycleLength, daysBetween(selectedCycle.start, addDays(today, 1)));
  const progress = Math.min(100, Math.max(0, (elapsed / cycleLength) * 100));
  const activeStay = data.stays.find((stay) => !stay.end);
  const sortedStays = [...data.stays].sort((a, b) => b.start.localeCompare(a.start));
  const lastStay = sortedStays[0];

  function openStay(stay: Stay | null = null) { setEditing(stay); setDialogOpen(true); }
  function saveStay(stay: Stay) {
    setData((previous) => previous ? { ...previous, stays: [...previous.stays.filter((item) => item.id !== stay.id), stay] } : previous);
    setNotice(editing ? "Stay updated." : "Stay added.");
  }
  function checkInOut() {
    const timestamp = new Date().toISOString();
    if (activeStay) {
      setData((previous) => previous ? { ...previous, stays: previous.stays.map((stay) => stay.id === activeStay.id ? { ...stay, end: timestamp } : stay) } : previous);
      setNotice("Checked out. Your stay was calculated using the exact time.");
    } else {
      setData((previous) => previous ? { ...previous, stays: [...previous.stays, { id: crypto.randomUUID(), start: timestamp }] } : previous);
      setNotice("Checked in. The 12-hour threshold has started.");
    }
    setNow(timestamp);
  }
  function removeStay(id: string) {
    if (!window.confirm("Delete this stay? Its days will be removed from both bill totals.")) return;
    setData((previous) => previous ? { ...previous, stays: previous.stays.filter((stay) => stay.id !== id) } : previous);
    setNotice("Stay deleted.");
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: "Boardmark", version: 2, data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boardmark-backup-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Backup downloaded.");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== "Boardmark" || (parsed.version !== 1 && parsed.version !== 2)) throw new Error("Invalid backup");
      const imported = normalizeData(parsed.data, parsed.version);
      if (!imported) throw new Error("Invalid backup");
      if (!window.confirm("Import this backup? It will replace the data on this device.")) return;
      setData(imported);
      setOffset(0);
      setNotice("Backup imported.");
    } catch { setNotice("This is not a valid Boardmark backup."); }
    if (importRef.current) importRef.current.value = "";
  }
  function selectBill(kind: BillKind) { setBill(kind); setOffset(0); }

  const navItems: { id: View; label: string; icon: typeof Home }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "stays", label: "Stay history", icon: CalendarDays },
    { id: "settings", label: "Settings", icon: Settings2 }
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="sidebar-top">
        <button className="brand" onClick={() => { setView("overview"); setMobileMenu(false); }} aria-label="Boardmark home"><span className="brand-mark"><Moon size={22} strokeWidth={2.3} /></span><span className="brand-word">boardmark<span className="brand-period">.</span></span></button>
        <button className="mobile-close" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X size={20} /></button>
      </div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${view === item.id ? "nav-active" : ""}`} onClick={() => { setView(item.id); setMobileMenu(false); }}><item.icon size={19} strokeWidth={1.9} /><span>{item.label}</span>{view === item.id && <span className="nav-active-line" />}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span className="tip-icon"><CircleHelp size={18} /></span><strong>How days are counted</strong><p>Up to 12 hours counts as 0 days. Over 12 hours rounds up to the next 24-hour day. Electric and water have separate cycles.</p></div>
        <div className="sidebar-profile"><span className="avatar">{data.name.trim() ? data.name.trim()[0].toUpperCase() : "B"}</span><span><strong>{data.name.trim() || "Your space"}</strong><small>Personal tracker</small></span><span className="profile-dots">•••</span></div>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}

    <main className="main-area">
      <header className="topbar"><button className="menu-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={22} /></button><div className="topbar-breadcrumb"><span>My workspace</span><ChevronRight size={15} /><strong>{view === "overview" ? "Overview" : view === "stays" ? "Stay history" : "Settings"}</strong></div><span className="topbar-date"><CalendarDays size={16} />{formatDate(today, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</span></header>
      <div className="content">
        {view === "overview" && <>
          <div className="page-heading"><div><span className="eyebrow">YOUR BOARDING DASHBOARD</span><h1>Good to see you{data.name.trim() ? `, ${data.name.trim().split(" ")[0]}` : ""}<span className="heading-dot">.</span></h1><p>See your billable days for electric and water, calculated from exact stay times.</p></div><Button variant="outline" onClick={() => openStay()}><Plus size={17} /> Add past stay</Button></div>
          <div className="overview-grid">
            <section className="hero-card"><div className="hero-ornament hero-ornament-one" /><div className="hero-ornament hero-ornament-two" /><div className="hero-content"><div className="hero-top"><span className="hero-label"><span className="hero-label-dot" /> CURRENT STAY STATUS</span><span className="hero-icon"><Moon size={24} /></span></div><div><h2>{activeStay ? "You’re checked in" : "Away from boarding"}</h2><p>{activeStay ? `Staying since ${formatDateTime(activeStay.start)}. Time is tracked automatically.` : "Heading back? Mark your check-in with one tap."}</p></div><div className="hero-footer"><Button className="hero-button" onClick={checkInOut}>{activeStay ? <LogOut size={18} /> : <LogIn size={18} />}{activeStay ? "Mark check-out now" : "Mark check-in now"}<ArrowRight size={17} /></Button><span className="hero-footnote">12 hours or less = 0 days</span></div></div></section>
            <BillCard kind="electric" days={electricDays} cycle={electricCycle} rate={data.electricRate} currency={data.currency} onSettings={() => setView("settings")} />
            <BillCard kind="water" days={waterDays} cycle={waterCycle} rate={data.waterRate} currency={data.currency} onSettings={() => setView("settings")} />
          </div>
          <div className="lower-grid">
            <section className="panel calendar-panel">
              <div className="panel-heading"><div><span className="eyebrow">YOUR STAY AT A GLANCE</span><h3>Bill cycle calendar</h3><p>Highlighted dates show when you were there; hours determine billable days.</p></div><div className="cycle-control"><button aria-label="Previous cycle" onClick={() => setOffset((value) => value - 1)}><ChevronLeft size={18} /></button><span>{formatCycle(selectedCycle)}</span><button aria-label="Next cycle" disabled={offset >= 0} onClick={() => setOffset((value) => value + 1)}><ChevronRight size={18} /></button></div></div>
              <div className="bill-tabs" role="tablist" aria-label="Bill type"><button role="tab" aria-selected={bill === "electric"} className={bill === "electric" ? "bill-tab-active" : ""} onClick={() => selectBill("electric")}><Zap size={15} /> Electric</button><button role="tab" aria-selected={bill === "water"} className={bill === "water" ? "bill-tab-active" : ""} onClick={() => selectBill("water")}><Droplets size={15} /> Water</button></div>
              <div className="calendar-legend"><span><i className="legend-stayed" /> Stayed</span><span><i className="legend-today" /> Today</span></div>
              <CalendarGrid cycle={selectedCycle} stays={data.stays} now={now} today={today} />
              <div className="calendar-summary"><span><strong>{selectedDays}</strong> billable {selectedDays === 1 ? "day" : "days"} in this {bill} cycle</span><span>{Math.round(progress)}% of cycle elapsed</span></div>
            </section>
            <div className="right-stack">
              <section className="panel cycle-panel"><div className="panel-icon">{bill === "electric" ? <Zap size={20} /> : <Droplets size={20} />}</div><span className="eyebrow">{bill.toUpperCase()} PERIOD</span><h3>{formatCycle(currentCycle)}</h3><p>Your next {bill} cycle begins on <strong>{formatDate(currentCycle.end, { month: "long", day: "numeric" })}</strong>.</p><div className="cycle-progress"><span style={{ width: `${Math.min(100, Math.max(0, daysBetween(currentCycle.start, addDays(today, 1)) / daysBetween(currentCycle.start, currentCycle.end) * 100))}%` }} /></div><div className="cycle-progress-labels"><span>{formatDate(currentCycle.start)}</span><span>{formatDate(addDays(currentCycle.end, -1))}</span></div></section>
              <section className="panel recent-panel"><div className="recent-title"><h3>Latest activity</h3><button onClick={() => setView("stays")}>View all <ArrowRight size={15} /></button></div>{lastStay ? <div className="activity-row"><div className={`activity-icon ${lastStay.end ? "activity-out" : "activity-in"}`}>{lastStay.end ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}</div><div><strong>{lastStay.end ? "Stay completed" : "Checked in"}</strong><p>{formatDateTime(lastStay.start)}{lastStay.end ? ` – ${formatDateTime(lastStay.end)}` : " · ongoing"}</p></div><span>{lastStay.end ? `${billableDays(lastStay, now)}d` : "Live"}</span></div> : <div className="recent-empty"><span className="empty-icon"><CalendarDays size={22} /></span><p>No stays yet. Your activity will show up here after you check in.</p></div>}</section>
            </div>
          </div>
        </>}

        {view === "stays" && <>
          <div className="page-heading"><div><span className="eyebrow">YOUR RECORD</span><h1>Stay history<span className="heading-dot">.</span></h1><p>Review or correct your check-in and check-out times.</p></div><Button onClick={() => openStay()}><Plus size={17} /> Add a stay</Button></div>
          <div className="history-summary"><span className="summary-icon"><Moon size={22} /></span><div><strong>{data.stays.length} recorded {data.stays.length === 1 ? "stay" : "stays"}</strong><p>Each bill uses its own cycle, with the same hour-based day rule.</p></div><StatusPill active={!!activeStay} /></div>
          <section className="panel history-panel"><div className="history-head"><span>STAY</span><span>BILLABLE</span><span>STATUS</span><span>ACTIONS</span></div>{sortedStays.length ? sortedStays.map((stay) => <div className="history-row" key={stay.id}><div className="history-date"><span className={`history-icon ${stay.end ? "history-done" : "history-live"}`}>{stay.end ? <Moon size={19} /> : <LogIn size={19} />}</span><div><strong>{formatDateTime(stay.start, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</strong><p>{stay.end ? `to ${formatDateTime(stay.end, { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Still checked in"}{stay.note ? ` · ${stay.note}` : ""}</p></div></div><span className="history-duration">{billableDays(stay, now)} {billableDays(stay, now) === 1 ? "day" : "days"}</span><span className={`history-status ${stay.end ? "history-complete" : "history-active"}`}>{stay.end ? "Completed" : "Ongoing"}</span><div className="history-actions"><button aria-label="Edit stay" title="Edit stay" onClick={() => openStay(stay)}><Edit3 size={17} /></button><button aria-label="Delete stay" title="Delete stay" onClick={() => removeStay(stay.id)}><Trash2 size={17} /></button></div></div>) : <div className="history-empty"><span className="empty-big-icon"><CalendarDays size={28} /></span><h3>No stays recorded yet</h3><p>Mark a check-in or add a past stay to start tracking your days.</p><Button onClick={() => openStay()}><Plus size={16} /> Add your first stay</Button></div>}</section>
        </>}

        {view === "settings" && <>
          <div className="page-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h1>Settings<span className="heading-dot">.</span></h1><p>Set separate billing periods for electric and water.</p></div></div>
          <div className="settings-grid"><section className="panel settings-panel">
            <div className="settings-section-heading"><span className="settings-section-icon settings-section-icon-amber"><Zap size={20} /></span><div><h3>Electric bill</h3><p>Cycle begins on the {ordinal(data.electricDay)}.</p></div></div>
            <div className="field-row"><label className="field"><span>Cycle starts on</span><select value={data.electricDay} onChange={(event) => { setData({ ...data, electricDay: Number(event.target.value) }); setOffset(0); }} aria-label="Electric cycle start day">{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{ordinal(index + 1)} day of each month</option>)}</select></label><label className="field"><span>Rate per billable day</span><input type="number" min="0" step="0.01" value={data.electricRate || ""} placeholder="Optional" onChange={(event) => setData({ ...data, electricRate: Math.max(0, Number(event.target.value) || 0) })} /></label></div>
            <div className="settings-divider" />
            <div className="settings-section-heading"><span className="settings-section-icon"><Droplets size={20} /></span><div><h3>Water bill</h3><p>Cycle begins on the {ordinal(data.waterDay)}.</p></div></div>
            <div className="field-row"><label className="field"><span>Cycle starts on</span><select value={data.waterDay} onChange={(event) => { setData({ ...data, waterDay: Number(event.target.value) }); setOffset(0); }} aria-label="Water cycle start day">{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{ordinal(index + 1)} day of each month</option>)}</select></label><label className="field"><span>Rate per billable day</span><input type="number" min="0" step="0.01" value={data.waterRate || ""} placeholder="Optional" onChange={(event) => setData({ ...data, waterRate: Math.max(0, Number(event.target.value) || 0) })} /></label></div>
            <p className="setting-note">For shorter months, a 29th–31st start uses the last day of that month. A billable day crossing a cycle boundary belongs to the cycle where its 24-hour block began.</p>
          </section><div className="settings-side">
            <section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><Home size={20} /></span><div><h3>Your space</h3><p>Personalize your dashboard and estimates.</p></div></div><label className="field"><span>Your name</span><input type="text" maxLength={40} placeholder="What should we call you?" value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} /></label><label className="field settings-currency"><span>Currency</span><select value={data.currency} onChange={(event) => setData({ ...data, currency: event.target.value })}><option value="LKR">LKR (Rs.)</option><option value="USD">USD ($)</option><option value="INR">INR (₹)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option></select></label></section>
            <section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-section-icon settings-section-icon-purple"><Download size={20} /></span><div><h3>Your data</h3><p>Saved in this browser on this device.</p></div></div><div className="backup-actions"><Button variant="outline" onClick={exportBackup}><Download size={16} /> Download backup</Button><Button variant="outline" onClick={() => importRef.current?.click()}><Upload size={16} /> Import backup</Button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => importBackup(event.target.files?.[0])} /></div><p className="setting-note">Use a backup to move your stays to another browser or device. Importing replaces the data there.</p></section>
          </div></div>
        </>}
        <footer className="footer"><span>© {new Date().getFullYear()} boardmark. Made for simpler boarding days.</span><span><Check size={14} /> Saved on this device</span></footer>
      </div>
    </main>
    {dialogOpen && <StayDialog stay={editing} stays={data.stays} now={now} onOpenChange={setDialogOpen} onSave={saveStay} />}
    {notice && <div className="toast" role="status"><Check size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
  </div>;
}
