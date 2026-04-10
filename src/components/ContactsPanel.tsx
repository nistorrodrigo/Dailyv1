import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";

interface Contact {
  email: string;
  name: string;
  selected: boolean;
}

interface SGList {
  id: string;
  name: string;
  count: number;
}

interface ContactsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactsPanel({ open, onClose }: ContactsPanelProps): React.ReactElement | null {
  const [lists, setLists] = useState<SGList[]>([]);
  const [selectedList, setSelectedList] = useState<SGList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListsLoading(true);
    fetch("/api/sendgrid-lists").then(r => r.json()).then(data => {
      if (data.ok) setLists(data.lists);
    }).finally(() => setListsLoading(false));
  }, [open]);

  const loadContacts = async (list: SGList) => {
    setSelectedList(list);
    setLoading(true);
    setContacts([]);
    try {
      const resp = await fetch(`/api/sendgrid-lists?listId=${list.id}`);
      const data = await resp.json();
      if (data.ok) {
        setContacts(data.contacts.map((c: { email: string; name: string }) => ({ ...c, selected: false })));
      }
    } catch (err) {
      alert("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  const selectedCount = contacts.filter(c => c.selected).length;
  const totalCount = contacts.length;

  const toggleAll = (selected: boolean) => {
    setContacts(prev => prev.map(c => {
      if (!search) return { ...c, selected };
      const q = search.toLowerCase();
      if (c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) return { ...c, selected };
      return c;
    }));
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
    const csv = "Name,Email\n" + rows.map(c => `"${c.name}","${c.email}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedList?.name || "contacts"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide">
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">
          {selectedList ? selectedList.name : "SendGrid Lists"}
        </span>
        <div className="flex gap-2">
          {selectedList && (
            <button
              onClick={() => { setSelectedList(null); setContacts([]); setSearch(""); }}
              className="text-[10px] font-bold text-[var(--color-sky)] bg-transparent border border-[var(--color-sky)] rounded px-2 py-1 cursor-pointer"
            >
              Back
            </button>
          )}
          <button onClick={onClose} className="bg-transparent border-none text-[var(--color-sky)] text-xl cursor-pointer">{"\u00D7"}</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Lists view */}
        {!selectedList && (
          <>
            {listsLoading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading lists...</p>}
            {lists.map(list => (
              <div
                key={list.id}
                onClick={() => loadContacts(list)}
                className="flex items-center justify-between p-3 mb-2 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)] cursor-pointer hover:bg-[var(--bg-hover)]"
              >
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{list.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{list.count} contacts</div>
                </div>
                <span className="text-[var(--text-muted)] text-lg">&#8250;</span>
              </div>
            ))}
          </>
        )}

        {/* Contacts view */}
        {selectedList && (
          <>
            {/* Search + actions */}
            <div className="flex gap-2 mb-3">
              <input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="themed-input flex-1 px-2.5 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </div>

            {/* Stats + bulk actions */}
            <div className="flex items-center gap-2 mb-3 text-[11px]">
              <span className="text-[var(--text-muted)]">
                {totalCount} contacts · {selectedCount} selected
                {search && ` · ${filtered.length} shown`}
              </span>
              <div className="flex-1" />
              <button onClick={() => toggleAll(true)} className="text-[10px] font-bold text-[var(--color-sky)] bg-transparent border-none cursor-pointer">Select All</button>
              <button onClick={() => toggleAll(false)} className="text-[10px] font-bold text-[var(--text-muted)] bg-transparent border-none cursor-pointer">Deselect</button>
            </div>

            {loading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading contacts...</p>}

            {/* Contact list */}
            <div className="max-h-[calc(100vh-350px)] overflow-auto">
              {filtered.map(c => (
                <div
                  key={c.email}
                  onClick={() => toggleOne(c.email)}
                  className={`flex items-center gap-3 px-3 py-2 mb-1 rounded cursor-pointer ${
                    c.selected ? "bg-blue-50 border border-blue-200" : "border border-transparent hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={c.selected}
                    onChange={() => toggleOne(c.email)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)] truncate">{c.name || c.email}</div>
                    {c.name && <div className="text-[10px] text-[var(--text-muted)] truncate">{c.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions footer */}
      {selectedList && contacts.length > 0 && (
        <div className="p-4 border-t border-[var(--border-light)] flex gap-2">
          <button
            onClick={copySelected}
            disabled={selectedCount === 0}
            className="flex-1 py-2.5 rounded-md border-none text-white text-xs font-bold cursor-pointer uppercase disabled:opacity-50"
            style={{ background: selectedCount > 0 ? BRAND.blue : "#999" }}
          >
            Copy {selectedCount} Emails
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] text-xs font-bold cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}
