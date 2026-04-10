import React, { useState, useEffect, useMemo } from "react";
import { BRAND } from "../constants/brand";

interface Contact {
  email: string;
  name: string;
  selected: boolean;
  domain: string;
  firstLetter: string;
}

interface SGList {
  id: string;
  name: string;
  count: number;
}

interface SavedFilter {
  name: string;
  emails: string[];
}

interface ContactsPanelProps {
  open: boolean;
  onClose: () => void;
}

const SAVED_FILTERS_KEY = "ls-contact-filters";

function loadSavedFilters(): SavedFilter[] {
  try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]"); } catch { return []; }
}

function saveSavedFilters(filters: SavedFilter[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

export default function ContactsPanel({ open, onClose }: ContactsPanelProps): React.ReactElement | null {
  const [lists, setLists] = useState<SGList[]>([]);
  const [selectedList, setSelectedList] = useState<SGList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [letterFilter, setLetterFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSavedFilters());
  const [filterName, setFilterName] = useState("");
  const [view, setView] = useState<"lists" | "contacts" | "saved">("lists");

  useEffect(() => {
    if (!open) return;
    setListsLoading(true);
    fetch("/api/sendgrid-lists").then(r => r.json()).then(data => {
      if (data.ok) setLists(data.lists);
    }).finally(() => setListsLoading(false));
  }, [open]);

  const loadContacts = async (list: SGList) => {
    setSelectedList(list);
    setView("contacts");
    setLoading(true);
    setContacts([]);
    setSearch("");
    setDomainFilter("");
    setLetterFilter("");
    try {
      const resp = await fetch(`/api/sendgrid-lists?listId=${list.id}`);
      const data = await resp.json();
      if (data.ok) {
        setContacts(data.contacts.map((c: { email: string; name: string }) => ({
          ...c,
          selected: false,
          domain: c.email.split("@")[1] || "",
          firstLetter: (c.name || c.email).charAt(0).toUpperCase(),
        })));
      }
    } catch { alert("Failed to load contacts"); }
    finally { setLoading(false); }
  };

  // Extract unique domains for filter
  const domains = useMemo(() => {
    const d: Record<string, number> = {};
    contacts.forEach(c => { d[c.domain] = (d[c.domain] || 0) + 1; });
    return Object.entries(d).sort((a, b) => b[1] - a[1]);
  }, [contacts]);

  // Filter contacts
  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.email.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
      }
      if (domainFilter && c.domain !== domainFilter) return false;
      if (letterFilter && c.firstLetter !== letterFilter) return false;
      return true;
    });
  }, [contacts, search, domainFilter, letterFilter]);

  if (!open) return null;

  const selectedCount = contacts.filter(c => c.selected).length;

  const toggleAll = (selected: boolean) => {
    const filteredEmails = new Set(filtered.map(c => c.email));
    setContacts(prev => prev.map(c => filteredEmails.has(c.email) ? { ...c, selected } : c));
  };

  const toggleOne = (email: string) => {
    setContacts(prev => prev.map(c => c.email === email ? { ...c, selected: !c.selected } : c));
  };

  const copySelected = () => {
    const emails = contacts.filter(c => c.selected).map(c => c.email);
    if (!emails.length) return alert("Select contacts first");
    navigator.clipboard.writeText(emails.join(", "));
    alert(`Copied ${emails.length} emails to clipboard`);
  };

  const exportCSV = () => {
    const rows = contacts.filter(c => c.selected || selectedCount === 0);
    const csv = "Name,Email,Domain\n" + rows.map(c => `"${c.name}","${c.email}","${c.domain}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedList?.name || "contacts"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveCurrentSelection = () => {
    if (!filterName.trim()) return alert("Enter a name for this selection");
    const emails = contacts.filter(c => c.selected).map(c => c.email);
    if (!emails.length) return alert("Select contacts first");
    const newFilter: SavedFilter = { name: filterName.trim(), emails };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    saveSavedFilters(updated);
    setFilterName("");
    alert(`Saved "${newFilter.name}" with ${emails.length} contacts`);
  };

  const loadSavedFilter = (filter: SavedFilter) => {
    const emailSet = new Set(filter.emails);
    setContacts(prev => prev.map(c => ({ ...c, selected: emailSet.has(c.email) })));
    setView("contacts");
  };

  const deleteSavedFilter = (index: number) => {
    const updated = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(updated);
    saveSavedFilters(updated);
  };

  const clearFilters = () => { setSearch(""); setDomainFilter(""); setLetterFilter(""); };
  const hasFilters = search || domainFilter || letterFilter;

  // Alphabet bar
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[520px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">
          {view === "contacts" && selectedList ? selectedList.name : view === "saved" ? "Saved Selections" : "Contact Manager"}
        </span>
        <div className="flex gap-2">
          {view !== "lists" && (
            <button onClick={() => { setView("lists"); setSelectedList(null); setContacts([]); clearFilters(); }}
              className="text-[10px] font-bold text-[var(--color-sky)] bg-transparent border border-[var(--color-sky)] rounded px-2 py-1 cursor-pointer">Back</button>
          )}
          <button onClick={onClose} className="bg-transparent border-none text-[var(--color-sky)] text-xl cursor-pointer">{"\u00D7"}</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* LISTS VIEW */}
        {view === "lists" && (
          <>
            {/* Saved selections button */}
            {savedFilters.length > 0 && (
              <button
                onClick={() => setView("saved")}
                className="w-full mb-3 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)] text-left cursor-pointer hover:bg-[var(--bg-hover)]"
              >
                <div className="text-sm font-bold text-[var(--text-primary)]">Saved Selections ({savedFilters.length})</div>
                <div className="text-[10px] text-[var(--text-muted)]">Your custom sub-lists</div>
              </button>
            )}

            {listsLoading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading lists...</p>}
            {lists.map(list => (
              <div key={list.id} onClick={() => loadContacts(list)}
                className="flex items-center justify-between p-3 mb-2 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)] cursor-pointer hover:bg-[var(--bg-hover)]">
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{list.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{list.count} contacts</div>
                </div>
                <span className="text-[var(--text-muted)] text-lg">&#8250;</span>
              </div>
            ))}
          </>
        )}

        {/* SAVED VIEW */}
        {view === "saved" && (
          <>
            {savedFilters.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 mb-2 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
                <div className="cursor-pointer flex-1" onClick={() => { if (selectedList) loadSavedFilter(f); else alert("Load a SendGrid list first, then apply this selection"); }}>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{f.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{f.emails.length} contacts</div>
                </div>
                <button onClick={() => deleteSavedFilter(i)} className="text-red-500 bg-transparent border-none cursor-pointer text-sm ml-2">{"\u00D7"}</button>
              </div>
            ))}
          </>
        )}

        {/* CONTACTS VIEW */}
        {view === "contacts" && selectedList && (
          <>
            {/* Search */}
            <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] mb-3" />

            {/* Domain filter */}
            {domains.length > 1 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">Filter by domain</div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setDomainFilter("")}
                    className={`px-2 py-1 rounded text-[9px] font-bold border cursor-pointer ${!domainFilter ? "bg-navy text-white border-navy" : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"}`}>
                    All
                  </button>
                  {domains.slice(0, 15).map(([d, count]) => (
                    <button key={d} onClick={() => setDomainFilter(domainFilter === d ? "" : d)}
                      className={`px-2 py-1 rounded text-[9px] font-bold border cursor-pointer ${domainFilter === d ? "bg-navy text-white border-navy" : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"}`}>
                      {d} ({count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alphabet filter */}
            <div className="mb-3">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">Filter A-Z</div>
              <div className="flex gap-0.5 flex-wrap">
                <button onClick={() => setLetterFilter("")}
                  className={`w-6 h-6 rounded text-[9px] font-bold border-none cursor-pointer ${!letterFilter ? "bg-navy text-white" : "bg-[var(--bg-card-alt)] text-[var(--text-muted)]"}`}>*</button>
                {letters.map(l => (
                  <button key={l} onClick={() => setLetterFilter(letterFilter === l ? "" : l)}
                    className={`w-6 h-6 rounded text-[9px] font-bold border-none cursor-pointer ${letterFilter === l ? "bg-navy text-white" : "bg-[var(--bg-card-alt)] text-[var(--text-muted)]"}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 mb-2 text-[11px]">
              <span className="text-[var(--text-muted)]">{filtered.length}/{contacts.length} shown · {selectedCount} selected</span>
              <div className="flex-1" />
              {hasFilters && <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 bg-transparent border-none cursor-pointer">Clear filters</button>}
              <button onClick={() => toggleAll(true)} className="text-[10px] font-bold text-[var(--color-sky)] bg-transparent border-none cursor-pointer">Select shown</button>
              <button onClick={() => toggleAll(false)} className="text-[10px] font-bold text-[var(--text-muted)] bg-transparent border-none cursor-pointer">Deselect</button>
            </div>

            {loading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading...</p>}

            {/* Contact list */}
            <div className="max-h-[calc(100vh-480px)] overflow-auto">
              {filtered.map(c => (
                <div key={c.email} onClick={() => toggleOne(c.email)}
                  className={`flex items-center gap-3 px-3 py-2 mb-0.5 rounded cursor-pointer transition-colors ${
                    c.selected ? "bg-blue-50 border border-blue-200" : "border border-transparent hover:bg-[var(--bg-hover)]"
                  }`}>
                  <input type="checkbox" checked={c.selected} onChange={() => toggleOne(c.email)} className="flex-shrink-0" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: BRAND.blue }}>
                    {c.firstLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{c.name || c.email}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{c.email}</div>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-card-alt)]">{c.domain}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      {view === "contacts" && contacts.length > 0 && (
        <div className="p-4 border-t border-[var(--border-light)]">
          {/* Save selection */}
          <div className="flex gap-2 mb-3">
            <input value={filterName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterName(e.target.value)}
              placeholder="Save as..."
              className="themed-input flex-1 px-2 py-1.5 rounded border border-[var(--border-input)] text-xs bg-[var(--bg-input)] text-[var(--text-primary)]" />
            <button onClick={saveCurrentSelection} disabled={selectedCount === 0}
              className="px-3 py-1.5 rounded text-[10px] font-bold border-none cursor-pointer text-white disabled:opacity-50"
              style={{ background: selectedCount > 0 ? "#2ecc71" : "#999" }}>Save</button>
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={copySelected} disabled={selectedCount === 0}
              className="flex-1 py-2.5 rounded-md border-none text-white text-xs font-bold cursor-pointer uppercase disabled:opacity-50"
              style={{ background: selectedCount > 0 ? BRAND.blue : "#999" }}>
              Copy {selectedCount} Emails
            </button>
            <button onClick={exportCSV}
              className="px-4 py-2.5 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] text-xs font-bold cursor-pointer">
              CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
