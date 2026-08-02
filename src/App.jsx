import React, { useState, useMemo } from "react";
import {
  Trophy, Shuffle, Plus, X, Check, ChevronRight, ChevronLeft,
  Users, ArrowLeft, RotateCcw, Pencil, Award, Medal
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const C = {
  bg: "#0A0F1C",              // สนามยามค่ำคืน — กรมท่าเข้มเกือบดำ
  surface: "#131A2B",         // การ์ด/กล่อง — เข้มกว่าพื้นหลังเล็กน้อย มีมิติ
  surface2: "#1B2440",        // พื้นผิวไฮไลท์/โฮเวอร์ อ่อนกว่า surface หนึ่งขั้น
  text: "#F4F6FB",            // ตัวหนังสือหลัก ขาวนวล คมชัดบนพื้นเข้ม
  muted: "#8B93AC",           // ตัวหนังสือรอง เทาอมฟ้า อ่านง่ายแต่ลดหลั่น
  border: "#232D4B",          // เส้นขอบปกติ
  borderLight: "#3A4770",     // เส้นขอบเน้น (แมตช์ที่จบแล้ว ฯลฯ)
  amber: "#FDB022",           // สีทองไฟสปอตไลท์สนาม — สีเด่นหลักของธีม
  amberDim: "rgba(253,176,34,0.14)", // พื้นหลังไฮไลท์สีอำพันโปร่งแสง
  teal: "#34D399",            // เขียว (ชนะ)
  red: "#FB7185",             // แดง (แพ้)
};

const TEAM_COLORS = ["#FFB627", "#00D9A3", "#FF5D5D", "#5DA9FF", "#C77DFF", "#FF8FB1", "#FFD23F", "#4ADE80", "#FF9F5A", "#7DD3FC"];
const TEAM_EMOJIS = ["⚽", "🏀", "🔥", "⚡", "🦁", "🐯", "🦅", "🐺", "👑", "💪", "🎯", "🚀", "🐉", "🦈", "🐗"];

const FORMATS = [
  { id: "group", name: "แบ่งกลุ่ม", desc: "แบ่งทีมออกเป็นกลุ่ม แข่งพบกันหมดในกลุ่ม แล้วจัดอันดับ", icon: Users },
  { id: "knockout", name: "แพ้คัดออก", desc: "จับคู่แข่งแบบสายเดี่ยว แพ้ตกรอบ ชนะเข้ารอบต่อไป", icon: Trophy },
  { id: "roundrobin", name: "พบกันหมด", desc: "ทุกทีมแข่งกับทุกทีม นับแต้มสะสมหาอันดับ", icon: Award },
];

/* ---------------------------------------------------------
   UTILS
--------------------------------------------------------- */
let uidCounter = 0;
const uid = () => `id_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRoundRobinMatches(teamIds, groupName = null) {
  const matches = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: uid(), group: groupName, round: null,
        teamAId: teamIds[i], teamBId: teamIds[j],
        scoreA: null, scoreB: null, statsA: {}, statsB: {}, assistsA: {}, assistsB: {}, status: "pending",
      });
    }
  }
  return matches;
}

function makeGroups(teamIds, numGroups) {
  const shuffled = shuffle(teamIds);
  const groups = Array.from({ length: numGroups }, (_, i) => ({ name: String.fromCharCode(65 + i), teamIds: [] }));
  shuffled.forEach((tid, idx) => groups[idx % numGroups].teamIds.push(tid));
  return groups;
}

function propagateWinner(list, match, winnerId) {
  const nextRound = match.round + 1;
  const nextSlot = Math.floor(match.slot / 2);
  const nextMatch = list.find((m) => m.round === nextRound && m.slot === nextSlot);
  if (nextMatch) {
    if (match.slot % 2 === 0) nextMatch.teamAId = winnerId;
    else nextMatch.teamBId = winnerId;
  }
}

function resolveByes(list) {
  const maxRound = Math.max(...list.map((m) => m.round));
  for (let r = 1; r <= maxRound; r++) {
    list.filter((m) => m.round === r).forEach((m) => {
      if (m.status === "done" || m.status === "bye") return;
      const aNull = m.teamAId === null, bNull = m.teamBId === null;
      if (aNull && bNull) return;
      if (aNull || bNull) {
        const winner = aNull ? m.teamBId : m.teamAId;
        if (winner !== null && winner !== undefined) {
          m.status = "bye";
          propagateWinner(list, m, winner);
        }
      }
    });
  }
  return list;
}

function buildBracketFromIds(ids) {
  let size = 1;
  while (size < ids.length) size *= 2;
  const padded = [...ids];
  while (padded.length < size) padded.push(null);
  const totalRounds = Math.log2(size);
  let matches = [];
  for (let i = 0; i < size / 2; i++) {
    matches.push({
      id: uid(), round: 1, slot: i, group: null,
      teamAId: padded[i * 2], teamBId: padded[i * 2 + 1],
      scoreA: null, scoreB: null, statsA: {}, statsB: {}, assistsA: {}, assistsB: {}, status: "pending",
    });
  }
  let prevCount = size / 2;
  for (let r = 2; r <= totalRounds; r++) {
    const count = prevCount / 2;
    for (let i = 0; i < count; i++) {
      matches.push({
        id: uid(), round: r, slot: i, group: null,
        teamAId: null, teamBId: null,
        scoreA: null, scoreB: null, statsA: {}, statsB: {}, assistsA: {}, assistsB: {}, status: "pending",
      });
    }
    prevCount = count;
  }
  return resolveByes(matches);
}

function makeBracket(teamIds) {
  return buildBracketFromIds(shuffle(teamIds));
}

function computeStandings(teamIds, matches) {
  const table = Object.fromEntries(teamIds.map((id) => [id, { teamId: id, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 }]));
  matches.filter((m) => m.status === "done").forEach((m) => {
    const a = table[m.teamAId], b = table[m.teamBId];
    if (!a || !b) return;
    a.played++; b.played++;
    a.gf += m.scoreA; a.ga += m.scoreB;
    b.gf += m.scoreB; b.ga += m.scoreA;
    if (m.scoreA > m.scoreB) { a.win++; b.loss++; a.pts += 3; }
    else if (m.scoreB > m.scoreA) { b.win++; a.loss++; b.pts += 3; }
    else { a.draw++; b.draw++; a.pts += 1; b.pts += 1; }
  });
  return Object.values(table).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

function computePlayerStats(teams, matches) {
  const stats = {};
  teams.forEach((t) => t.players.forEach((p) => { stats[p.id] = { playerId: p.id, name: p.name, number: p.number, teamId: t.id, total: 0, assists: 0 }; }));
  matches.filter((m) => m.status === "done" || m.status === "bye").forEach((m) => {
    Object.entries(m.statsA || {}).forEach(([pid, val]) => { if (stats[pid]) stats[pid].total += Number(val) || 0; });
    Object.entries(m.statsB || {}).forEach(([pid, val]) => { if (stats[pid]) stats[pid].total += Number(val) || 0; });
    Object.entries(m.assistsA || {}).forEach(([pid, val]) => { if (stats[pid]) stats[pid].assists += Number(val) || 0; });
    Object.entries(m.assistsB || {}).forEach(([pid, val]) => { if (stats[pid]) stats[pid].assists += Number(val) || 0; });
  });
  return Object.values(stats).sort((a, b) => b.total - a.total || b.assists - a.assists);
}

function useStickyState(defaultValue, key) {
  const [value, setValue] = useState(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });
  React.useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

/* ---------------------------------------------------------
   SHARED UI
--------------------------------------------------------- */
function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
      .tk-teko { font-family: 'Teko', sans-serif; letter-spacing: 0.3px; }
      .tk-mono { font-family: 'JetBrains Mono', monospace; }
      * { font-family: 'Manrope', sans-serif; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
      body { background: ${C.bg}; }
      ::-webkit-scrollbar { height: 8px; width: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${C.borderLight}; border-radius: 4px; }
      input:focus, select:focus, button:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 1px; }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
    `}</style>
  );
}

function ScoreDisplay({ a, b, size = "md" }) {
  const sizes = { sm: 20, md: 30, lg: 52 };
  const fs = sizes[size];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, background: "#050810",
      border: `1px solid ${C.border}`, borderRadius: 8, padding: `${fs * 0.14}px ${fs * 0.4}px`,
      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)",
    }}>
      <span className="tk-teko" style={{ fontSize: fs, color: C.amber, textShadow: `0 0 12px rgba(253,176,34,0.55)`, lineHeight: 1, minWidth: fs * 0.6, textAlign: "center" }}>{a ?? "–"}</span>
      <span className="tk-teko" style={{ fontSize: fs * 0.8, color: C.borderLight, lineHeight: 1 }}>:</span>
      <span className="tk-teko" style={{ fontSize: fs, color: C.amber, textShadow: `0 0 12px rgba(253,176,34,0.55)`, lineHeight: 1, minWidth: fs * 0.6, textAlign: "center" }}>{b ?? "–"}</span>
    </div>
  );
}

function TeamTag({ team, size = "md" }) {
  if (!team) return <span style={{ color: C.muted }}>รอทราบคู่แข่ง</span>;
  const fs = size === "sm" ? 13 : 15;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ width: fs + 12, height: fs + 12, borderRadius: 8, background: team.color + "22", border: `1px solid ${team.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs, flexShrink: 0 }}>
        {team.emoji}
      </div>
      <span style={{ fontSize: fs, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style, type = "button" }) {
  const variants = {
    primary: { background: C.amber, color: "#1A1300", border: "1px solid " + C.amber, fontWeight: 700, boxShadow: "0 4px 14px rgba(253,176,34,0.28)" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}`, fontWeight: 600 },
    subtle: { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, fontWeight: 600 },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}55`, fontWeight: 600 },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant], padding: "10px 18px", borderRadius: 10, fontSize: 14.5,
        display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, transition: "transform 0.12s, opacity 0.12s, background 0.15s", ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input {...props} style={{
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px",
      color: C.text, fontSize: 14, width: "100%", ...props.style,
    }} />
  );
}

/* ---------------------------------------------------------
   HOME
--------------------------------------------------------- */
function Home({ onStart, onShowHistory, historyCount }) {
  const [format, setFormat] = useState(null);
  const [sport, setSport] = useState("football");
  const [name, setName] = useState("");

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "flex",
          alignItems: "center", justifyContent: "center", background: C.amberDim,
          border: `1px solid ${C.amber}55`, boxShadow: "0 0 40px rgba(253,176,34,0.25)",
        }}>
          <Trophy size={28} color={C.amber} />
        </div>
        <div className="tk-teko" style={{ fontSize: 64, color: C.text, letterSpacing: 1, lineHeight: 1 }}>
          จัด<span style={{ color: C.amber }}>ทัวร์นาเมนต์</span>
        </div>
        <p style={{ color: C.muted, fontSize: 15, marginTop: 8 }}>สร้างตารางแข่งขันฟุตบอล บาสเกตบอล พร้อมสถิติทีมและผู้เล่น</p>
        {historyCount > 0 && (
          <button onClick={onShowHistory} style={{
            marginTop: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted,
            borderRadius: 20, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <RotateCcw size={13} /> ดูประวัติการสร้างทัวร์นาเมนต์ ({historyCount})
          </button>
        )}
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>ตั้งชื่อทัวร์นาเมนต์</div>
        <Input placeholder="เช่น ศึกลูกหนังคืนวันศุกร์ 2026" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "13px 14px", fontSize: 15 }} />
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>เลือกชนิดกีฬา</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ id: "football", label: "⚽ ฟุตบอล" }, { id: "basketball", label: "🏀 บาสเกตบอล" }].map((s) => (
            <button key={s.id} onClick={() => setSport(s.id)} style={{
              flex: 1, padding: "14px", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700,
              background: sport === s.id ? C.amberDim : C.surface, color: sport === s.id ? C.amber : C.text,
              border: `1px solid ${sport === s.id ? C.amber : C.border}`,
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>เลือกรูปแบบทัวร์นาเมนต์</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const active = format === f.id;
            return (
              <button key={f.id} onClick={() => setFormat(f.id)} style={{
                textAlign: "left", padding: 20, borderRadius: 14, cursor: "pointer",
                background: active ? C.surface2 : C.surface, border: `1.5px solid ${active ? C.amber : C.border}`,
                display: "flex", flexDirection: "column", gap: 10,
                boxShadow: active ? "0 6px 20px rgba(253,176,34,0.14)" : "0 2px 8px rgba(0,0,0,0.2)",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}>
                <Icon size={22} color={active ? C.amber : C.muted} />
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{f.name}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Button disabled={!format || !name.trim()} onClick={() => onStart(format, sport, name.trim())} style={{ padding: "13px 32px", fontSize: 15.5 }}>
          เริ่มสร้างทัวร์นาเมนต์ <ChevronRight size={18} />
        </Button>
        {!name.trim() && <span style={{ fontSize: 12, color: C.muted }}>กรุณาตั้งชื่อทัวร์นาเมนต์ก่อนเริ่ม</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TEAM SETUP
--------------------------------------------------------- */
function TeamEditor({ team, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pNum, setPNum] = useState("");

  const addPlayer = () => {
    if (!pName.trim()) return;
    onUpdate({ ...team, players: [...team.players, { id: uid(), name: pName.trim(), number: pNum.trim() }] });
    setPName(""); setPNum("");
  };
  const removePlayer = (pid) => onUpdate({ ...team, players: team.players.filter((p) => p.id !== pid) });

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
        <TeamTag team={team} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: C.muted }}>{team.players.length} ผู้เล่น</span>
        <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 6 }}>
          <Pencil size={15} />
        </button>
        <button onClick={onRemove} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", padding: 6 }}>
          <X size={16} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
            {TEAM_COLORS.map((c) => (
              <button key={c} onClick={() => onUpdate({ ...team, color: c })} style={{
                width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
                border: team.color === c ? `2px solid ${C.text}` : "2px solid transparent",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {TEAM_EMOJIS.map((e) => (
              <button key={e} onClick={() => onUpdate({ ...team, emoji: e })} style={{
                width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 15,
                background: team.emoji === e ? C.amberDim : C.surface2, border: `1px solid ${team.emoji === e ? C.amber : C.border}`,
              }}>{e}</button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 700, marginBottom: 8 }}>รายชื่อผู้เล่น</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {team.players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, borderRadius: 8, padding: "7px 10px" }}>
                <span className="tk-mono" style={{ color: C.amber, fontSize: 13, minWidth: 24 }}>{p.number || "-"}</span>
                <span style={{ fontSize: 13.5, flex: 1 }}>{p.name}</span>
                <button onClick={() => removePlayer(p.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input placeholder="เบอร์" value={pNum} onChange={(e) => setPNum(e.target.value)} style={{ width: 64 }} />
            <Input placeholder="ชื่อผู้เล่น" value={pName} onChange={(e) => setPName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
            <Button variant="subtle" onClick={addPlayer}><Plus size={14} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSetup({ teams, setTeams, format, numGroups, setNumGroups, onBack, onNext }) {
  const [name, setName] = useState("");

  const addTeam = () => {
    if (!name.trim()) return;
    const usedColors = teams.map((t) => t.color);
    const color = TEAM_COLORS.find((c) => !usedColors.includes(c)) || TEAM_COLORS[teams.length % TEAM_COLORS.length];
    const emoji = TEAM_EMOJIS[teams.length % TEAM_EMOJIS.length];
    setTeams([...teams, { id: uid(), name: name.trim(), color, emoji, players: [] }]);
    setName("");
  };

  const maxGroups = Math.max(2, Math.floor(teams.length / 2));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 13.5 }}>
        <ArrowLeft size={15} /> กลับ
      </button>
      <h2 className="tk-teko" style={{ fontSize: 34, marginBottom: 4 }}>ใส่ทีมที่เข้าแข่งขัน</h2>
      <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 22 }}>ตั้งชื่อทีม เลือกสี โลโก้ และเพิ่มสมาชิกในทีม (แตะไอคอนดินสอเพื่อแก้ไขสมาชิก)</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Input placeholder="ชื่อทีมใหม่ เช่น สิงห์อาสา FC" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTeam()} />
        <Button onClick={addTeam}><Plus size={15} /> เพิ่มทีม</Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
        {teams.map((t) => (
          <TeamEditor key={t.id} team={t} onUpdate={(nt) => setTeams(teams.map((x) => (x.id === nt.id ? nt : x)))} onRemove={() => setTeams(teams.filter((x) => x.id !== t.id))} />
        ))}
        {teams.length === 0 && <div style={{ color: C.muted, fontSize: 13.5, textAlign: "center", padding: 24, border: `1px dashed ${C.border}`, borderRadius: 12 }}>ยังไม่มีทีม — เพิ่มทีมอย่างน้อย 2 ทีม</div>}
      </div>

      {format === "group" && teams.length >= 2 && (
        <div style={{ marginBottom: 26, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>จำนวนกลุ่ม</span>
          <input type="range" min={2} max={maxGroups} value={Math.min(numGroups, maxGroups)} onChange={(e) => setNumGroups(Number(e.target.value))} style={{ flex: 1, accentColor: C.amber }} />
          <span className="tk-teko" style={{ fontSize: 22, color: C.amber, minWidth: 24, textAlign: "center" }}>{Math.min(numGroups, maxGroups)}</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button disabled={teams.length < 2} onClick={onNext}>ไปหน้าจับสลาก <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   DRAW
--------------------------------------------------------- */
function Draw({ teams, format, numGroups, onBack, onConfirm }) {
  const [preview, setPreview] = useState(null);
  const [seedIds, setSeedIds] = useState(null); // knockout: linear seed order incl. nulls for byes

  const teamById = (id) => teams.find((t) => t.id === id);
  const groupCount = Math.min(numGroups, Math.max(2, Math.floor(teams.length / 2)));
  const bracketSize = (() => { let s = 1; while (s < teams.length) s *= 2; return s; })();

  const buildGroupPreview = (groups) => ({
    groups,
    matches: groups.flatMap((g) => makeRoundRobinMatches(g.teamIds, g.name)),
  });

  // --- สุ่ม ---
  const roll = () => {
    const teamIds = teams.map((t) => t.id);
    if (format === "group") {
      setPreview(buildGroupPreview(makeGroups(teamIds, groupCount)));
    } else if (format === "roundrobin") {
      setPreview({ groups: [{ name: null, teamIds }], matches: makeRoundRobinMatches(teamIds, null) });
    } else {
      const shuffled = shuffle(teamIds);
      const padded = [...shuffled];
      while (padded.length < bracketSize) padded.push(null);
      setSeedIds(padded);
      setPreview({ groups: null, matches: buildBracketFromIds(padded) });
    }
  };

  // --- จัดเอง (เริ่มจากว่าง/เรียงตามลำดับเดิม แล้วปรับเองทั้งหมด) ---
  const startManual = () => {
    if (format === "group") {
      const groups = Array.from({ length: groupCount }, (_, i) => ({ name: String.fromCharCode(65 + i), teamIds: [] }));
      setPreview(buildGroupPreview(groups));
    } else if (format === "roundrobin") {
      const teamIds = teams.map((t) => t.id);
      setPreview({ groups: [{ name: null, teamIds }], matches: makeRoundRobinMatches(teamIds, null) });
    } else {
      const ordered = teams.map((t) => t.id);
      while (ordered.length < bracketSize) ordered.push(null);
      setSeedIds(ordered);
      setPreview({ groups: null, matches: buildBracketFromIds(ordered) });
    }
  };

  // --- ย้ายทีมไปกลุ่มอื่นด้วยตัวเอง (format: group) ---
  const moveTeamToGroup = (teamId, newGroupName) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const groups = prev.groups.map((g) => ({ ...g, teamIds: g.teamIds.filter((id) => id !== teamId) }));
      const target = groups.find((g) => g.name === newGroupName);
      if (target) target.teamIds.push(teamId);
      return buildGroupPreview(groups);
    });
  };

  // --- ตั้งทีมลงตำแหน่งสายใดสายหนึ่งเอง (format: knockout) — สลับตำแหน่งกับทีมเดิมถ้าซ้ำ ---
  const setSeedSlot = (idx, teamId) => {
    const next = [...seedIds];
    if (!teamId) {
      next[idx] = null;
    } else {
      const otherIdx = next.indexOf(teamId);
      if (otherIdx !== -1 && otherIdx !== idx) next[otherIdx] = next[idx];
      next[idx] = teamId;
    }
    setSeedIds(next);
    setPreview({ groups: null, matches: buildBracketFromIds(next) });
  };

  const unassigned = preview && format === "group" ? teams.filter((t) => !preview.groups.some((g) => g.teamIds.includes(t.id))) : [];
  const canConfirmGroup = format !== "group" || unassigned.length === 0;

  const selectStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
    fontSize: 12.5, padding: "4px 6px", cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px 80px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 13.5 }}>
        <ArrowLeft size={15} /> กลับไปแก้ทีม
      </button>
      <h2 className="tk-teko" style={{ fontSize: 34, marginBottom: 4 }}>จับสลากแบ่งคู่แข่ง</h2>
      <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 22 }}>สุ่มได้เรื่อยๆ หรือจัดทีมเข้ากลุ่ม/สายเองก็ได้ แล้วกดยืนยันเพื่อเริ่มแข่งขัน</p>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
        <Button onClick={roll} style={{ padding: "13px 24px" }}><Shuffle size={17} /> {preview ? "สุ่มใหม่" : "สุ่มจับสลาก"}</Button>
        <Button variant="subtle" onClick={startManual} style={{ padding: "13px 24px" }}><Pencil size={16} /> จัดเอง</Button>
      </div>

      {preview && format === "group" && (
        <>
          {unassigned.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.amber}55`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: C.amber, fontWeight: 700, marginBottom: 10 }}>ทีมที่ยังไม่ได้จัดกลุ่ม ({unassigned.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {unassigned.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, borderRadius: 8, padding: "6px 10px" }}>
                    <TeamTag team={t} size="sm" />
                    <select defaultValue="" onChange={(e) => e.target.value && moveTeamToGroup(t.id, e.target.value)} style={selectStyle}>
                      <option value="" disabled>ใส่กลุ่ม...</option>
                      {preview.groups.map((g) => <option key={g.name} value={g.name}>กลุ่ม {g.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            {preview.groups.map((g) => (
              <div key={g.name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div className="tk-teko" style={{ fontSize: 20, color: C.amber, marginBottom: 8 }}>กลุ่ม {g.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.teamIds.map((tid) => (
                    <div key={tid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><TeamTag team={teamById(tid)} size="sm" /></div>
                      <select value={g.name} onChange={(e) => moveTeamToGroup(tid, e.target.value)} style={selectStyle}>
                        {preview.groups.map((gg) => <option key={gg.name} value={gg.name}>{gg.name}</option>)}
                        <option value="">เอาออก</option>
                      </select>
                    </div>
                  ))}
                  {g.teamIds.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>ยังไม่มีทีมในกลุ่มนี้</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {preview && format === "roundrobin" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginBottom: 10 }}>คู่แข่งขันทั้งหมด {preview.matches.length} คู่ (ทุกทีมพบกันหมด ลำดับไม่มีผลต่อผลการแข่งขัน)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {preview.matches.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <TeamTag team={teamById(m.teamAId)} size="sm" /> <span style={{ color: C.muted }}>vs</span> <TeamTag team={teamById(m.teamBId)} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && format === "knockout" && seedIds && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginBottom: 10 }}>รอบแรก — เลือกทีมลงแต่ละช่องเองได้ (ว่าง = บาย ผ่านรอบอัตโนมัติ)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: bracketSize / 2 }, (_, i) => i).map((i) => {
              const idxA = i * 2, idxB = i * 2 + 1;
              const usedElsewhere = (excludeIdx) => new Set(seedIds.filter((_, idx) => idx !== excludeIdx));
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, flexWrap: "wrap" }}>
                  <span style={{ color: C.muted, fontSize: 11.5, width: 20 }}>{i + 1}.</span>
                  <select value={seedIds[idxA] || ""} onChange={(e) => setSeedSlot(idxA, e.target.value || null)} style={selectStyle}>
                    <option value="">— ว่าง (บาย) —</option>
                    {teams.filter((t) => !usedElsewhere(idxA).has(t.id) || t.id === seedIds[idxA]).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <span style={{ color: C.muted }}>vs</span>
                  <select value={seedIds[idxB] || ""} onChange={(e) => setSeedSlot(idxB, e.target.value || null)} style={selectStyle}>
                    <option value="">— ว่าง (บาย) —</option>
                    {teams.filter((t) => !usedElsewhere(idxB).has(t.id) || t.id === seedIds[idxB]).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {preview && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <Button disabled={!canConfirmGroup} onClick={() => onConfirm(preview)}><Check size={16} /> ยืนยันและเริ่มแข่งขัน</Button>
          {!canConfirmGroup && <span style={{ fontSize: 12, color: C.muted }}>กรุณาจัดทุกทีมลงกลุ่มก่อนยืนยัน</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   MATCH MODAL
--------------------------------------------------------- */
function StatRows({ team, stats, setStats, assists, setAssists, statLabel, onUpdateTeam }) {
  return (
    <div style={{ flex: 1, minWidth: 230 }}>
      <TeamTag team={team} />
      {team.players.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 4 }}>
          <span style={{ width: 22 }} />
          <span style={{ flex: 1 }} />
          <span style={{ width: 56, fontSize: 10, color: C.muted, textAlign: "center" }}>{statLabel}</span>
          <span style={{ width: 56, fontSize: 10, color: C.muted, textAlign: "center" }}>แอสซิสต์</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {team.players.length === 0 && <div style={{ color: C.muted, fontSize: 12.5, marginTop: 10 }}>ทีมนี้ยังไม่มีรายชื่อผู้เล่น</div>}
        {team.players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="tk-mono" style={{ color: C.amber, fontSize: 12, width: 22 }}>{p.number || "-"}</span>
            <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <Input type="number" min={0} value={stats[p.id] ?? ""} placeholder="0" onChange={(e) => setStats({ ...stats, [p.id]: e.target.value })} style={{ width: 56, padding: "5px 8px", fontSize: 12.5 }} />
            <Input type="number" min={0} value={assists[p.id] ?? ""} placeholder="0" onChange={(e) => setAssists({ ...assists, [p.id]: e.target.value })} style={{ width: 56, padding: "5px 8px", fontSize: 12.5 }} />
          </div>
        ))}
      </div>
      {onUpdateTeam && <MiniPlayerEditor team={team} onUpdateTeam={onUpdateTeam} />}
    </div>
  );
}

function MiniPlayerEditor({ team, onUpdateTeam }) {
  const [open, setOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pNum, setPNum] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNum, setEditNum] = useState("");

  const addPlayer = () => {
    if (!pName.trim()) return;
    onUpdateTeam(team.id, (t) => ({ ...t, players: [...t.players, { id: uid(), name: pName.trim(), number: pNum.trim() }] }));
    setPName(""); setPNum("");
  };
  const removePlayer = (pid) => onUpdateTeam(team.id, (t) => ({ ...t, players: t.players.filter((p) => p.id !== pid) }));
  const startEdit = (p) => { setEditingId(p.id); setEditName(p.name); setEditNum(p.number || ""); };
  const saveEdit = () => {
    onUpdateTeam(team.id, (t) => ({ ...t, players: t.players.map((p) => (p.id === editingId ? { ...p, name: editName.trim() || p.name, number: editNum.trim() } : p)) }));
    setEditingId(null);
  };

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", color: C.amber, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
        <Pencil size={12} /> แก้ไข/เพิ่มรายชื่อผู้เล่น
      </button>
      {open && (
        <div style={{ marginTop: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {team.players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {editingId === p.id ? (
                  <>
                    <Input value={editNum} onChange={(e) => setEditNum(e.target.value)} placeholder="เบอร์" style={{ width: 48, padding: "5px 6px", fontSize: 12 }} />
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ชื่อ" style={{ flex: 1, padding: "5px 6px", fontSize: 12 }} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    <button onClick={saveEdit} style={{ background: "transparent", border: "none", color: C.teal, cursor: "pointer" }}><Check size={13} /></button>
                  </>
                ) : (
                  <>
                    <span className="tk-mono" style={{ color: C.amber, fontSize: 11.5, width: 22 }}>{p.number || "-"}</span>
                    <span style={{ fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <button onClick={() => startEdit(p)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><Pencil size={12} /></button>
                    <button onClick={() => removePlayer(p.id)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={12} /></button>
                  </>
                )}
              </div>
            ))}
            {team.players.length === 0 && <div style={{ color: C.muted, fontSize: 11.5 }}>ยังไม่มีผู้เล่น</div>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Input placeholder="เบอร์" value={pNum} onChange={(e) => setPNum(e.target.value)} style={{ width: 48, padding: "6px 8px", fontSize: 12 }} />
            <Input placeholder="เพิ่มชื่อผู้เล่นใหม่" value={pName} onChange={(e) => setPName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} style={{ flex: 1, padding: "6px 8px", fontSize: 12 }} />
            <Button variant="subtle" onClick={addPlayer} style={{ padding: "6px 10px" }}><Plus size={13} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchModal({ match, teamA, teamB, sport, onClose, onSave, onUpdateTeam }) {
  const [scoreA, setScoreA] = useState(match.scoreA ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB ?? "");
  const [statsA, setStatsA] = useState({ ...match.statsA });
  const [statsB, setStatsB] = useState({ ...match.statsB });
  const [assistsA, setAssistsA] = useState({ ...match.assistsA });
  const [assistsB, setAssistsB] = useState({ ...match.assistsB });
  const [tieWinner, setTieWinner] = useState(null);

  const unit = sport === "basketball" ? "แต้ม" : "ประตู";
  const isKnockout = match.round != null;
  const tied = scoreA !== "" && scoreB !== "" && Number(scoreA) === Number(scoreB);

  const save = () => {
    if (scoreA === "" || scoreB === "") return;
    if (isKnockout && tied && !tieWinner) return;
    onSave({
      ...match,
      scoreA: Number(scoreA), scoreB: Number(scoreB),
      statsA, statsB, assistsA, assistsB, status: "done",
      tieWinner: tied ? tieWinner : null,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,7,12,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 className="tk-teko" style={{ fontSize: 24 }}>บันทึกผลการแข่งขัน</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
          <TeamTag team={teamA} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input type="number" min={0} value={scoreA} onChange={(e) => setScoreA(e.target.value)} style={{ width: 56, textAlign: "center", fontSize: 18 }} />
            <span style={{ color: C.muted }}>:</span>
            <Input type="number" min={0} value={scoreB} onChange={(e) => setScoreB(e.target.value)} style={{ width: 56, textAlign: "center", fontSize: 18 }} />
          </div>
          <TeamTag team={teamB} />
        </div>
        <div style={{ textAlign: "center", fontSize: 11.5, color: C.muted, marginBottom: 18 }}>หน่วยสกอ: {unit}</div>

        {isKnockout && tied && (
          <div style={{ marginBottom: 18, background: C.amberDim, border: `1px solid ${C.amber}55`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: C.amber }}>สกอเสมอ — เลือกทีมที่ชนะ (เช่น ดวลจุดโทษ/ต่อเวลา)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant={tieWinner === teamA.id ? "primary" : "subtle"} onClick={() => setTieWinner(teamA.id)} style={{ flex: 1, justifyContent: "center" }}>{teamA.name}</Button>
              <Button variant={tieWinner === teamB.id ? "primary" : "subtle"} onClick={() => setTieWinner(teamB.id)} style={{ flex: 1, justifyContent: "center" }}>{teamB.name}</Button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 700, marginBottom: 10 }}>สกอรายผู้เล่น (ไม่บังคับ)</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
          <StatRows team={teamA} stats={statsA} setStats={setStatsA} assists={assistsA} setAssists={setAssistsA} statLabel={unit} onUpdateTeam={onUpdateTeam} />
          <StatRows team={teamB} stats={statsB} setStats={setStatsB} assists={assistsB} setAssists={setAssistsB} statLabel={unit} onUpdateTeam={onUpdateTeam} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={scoreA === "" || scoreB === "" || (isKnockout && tied && !tieWinner)}><Check size={15} /> บันทึกผล</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MATCH CARD & LIST
--------------------------------------------------------- */
function MatchCard({ match, teamA, teamB, onClick }) {
  const playable = teamA && teamB;
  const isBye = match.status === "bye";
  return (
    <button
      onClick={playable ? onClick : undefined}
      disabled={!playable}
      style={{
        width: "100%", textAlign: "left", background: C.surface, border: `1px solid ${match.status === "done" ? C.borderLight : C.border}`,
        borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: playable ? "pointer" : "default",
        opacity: playable ? 1 : 0.55, boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{teamA ? <TeamTag team={teamA} size="sm" /> : <span style={{ color: C.muted, fontSize: 13 }}>รอทราบคู่แข่ง</span>}</div>
      {isBye ? (
        <span style={{ fontSize: 12, color: C.teal, fontWeight: 700, whiteSpace: "nowrap" }}>บาย</span>
      ) : (
        <ScoreDisplay a={match.scoreA} b={match.scoreB} size="sm" />
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>{teamB ? <TeamTag team={teamB} size="sm" /> : <span style={{ color: C.muted, fontSize: 13 }}>รอทราบคู่แข่ง</span>}</div>
    </button>
  );
}

/* ---------------------------------------------------------
   STANDINGS TABLE
--------------------------------------------------------- */
function StandingsTable({ rows, teamById }) {
  return (
    <div style={{ overflowX: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.22)", padding: "4px 10px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.muted, textAlign: "center", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
            <th style={{ padding: "8px 6px", textAlign: "left" }}>ทีม</th>
            <th style={{ padding: "8px 6px" }}>แข่ง</th>
            <th style={{ padding: "8px 6px" }}>ชนะ</th>
            <th style={{ padding: "8px 6px" }}>เสมอ</th>
            <th style={{ padding: "8px 6px" }}>แพ้</th>
            <th style={{ padding: "8px 6px" }}>ได้</th>
            <th style={{ padding: "8px 6px" }}>เสีย</th>
            <th style={{ padding: "8px 6px" }}>ต่าง</th>
            <th style={{ padding: "8px 6px", color: C.amber }}>แต้ม</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = teamById(r.teamId);
            if (!t) return null;
            return (
              <tr key={r.teamId} style={{ borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
                <td style={{ padding: "9px 6px", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="tk-mono" style={{ color: C.muted, fontSize: 11.5, width: 14 }}>{i + 1}</span>
                    <TeamTag team={t} size="sm" />
                  </div>
                </td>
                <td className="tk-mono" style={{ padding: "9px 6px" }}>{r.played}</td>
                <td className="tk-mono" style={{ padding: "9px 6px", color: C.teal }}>{r.win}</td>
                <td className="tk-mono" style={{ padding: "9px 6px" }}>{r.draw}</td>
                <td className="tk-mono" style={{ padding: "9px 6px", color: C.red }}>{r.loss}</td>
                <td className="tk-mono" style={{ padding: "9px 6px" }}>{r.gf}</td>
                <td className="tk-mono" style={{ padding: "9px 6px" }}>{r.ga}</td>
                <td className="tk-mono" style={{ padding: "9px 6px" }}>{r.gf - r.ga}</td>
                <td className="tk-mono" style={{ padding: "9px 6px", color: C.amber, fontWeight: 700 }}>{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsList({ stats, teamById, unit }) {
  const medalColors = [C.amber, "#C0C6D6", "#C67C4E"];
  const ranked = stats.filter((s) => s.total > 0 || s.assists > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ranked.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>ยังไม่มีข้อมูลสกอผู้เล่น</div>}
      {ranked.map((s, i) => {
        const t = teamById(s.teamId);
        return (
          <div key={s.playerId} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px" }}>
            {i < 3 ? <Medal size={16} color={medalColors[i]} /> : <span className="tk-mono" style={{ width: 16, textAlign: "center", color: C.muted, fontSize: 12 }}>{i + 1}</span>}
            {t && <TeamTag team={t} size="sm" />}
            <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{s.name}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="tk-teko" style={{ fontSize: 22, color: C.amber }}>{s.total}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{unit}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 62, justifyContent: "flex-end" }}>
              <span className="tk-teko" style={{ fontSize: 22, color: C.teal }}>{s.assists}</span>
              <span style={{ fontSize: 11, color: C.muted }}>แอสซิสต์</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   HISTORY
--------------------------------------------------------- */
function getTournamentChampion(record) {
  const { teams = [], matches = [], format } = record;
  const teamById = (id) => teams.find((t) => t.id === id);
  const winnerOf = (m) => (m ? teamById(m.tieWinner || (m.scoreA > m.scoreB ? m.teamAId : m.teamBId)) : null);
  if (format === "knockout") {
    const rounds = [...new Set(matches.map((m) => m.round))];
    if (!rounds.length) return null;
    const maxRound = Math.max(...rounds);
    const finalMatch = matches.find((m) => m.round === maxRound);
    return finalMatch && finalMatch.status === "done" ? winnerOf(finalMatch) : null;
  }
  if (format === "group") {
    const koMatches = matches.filter((m) => m.group === "KO");
    if (!koMatches.length) return null;
    const maxRound = Math.max(...koMatches.map((m) => m.round));
    const finalMatch = koMatches.find((m) => m.round === maxRound);
    return finalMatch && finalMatch.status === "done" ? winnerOf(finalMatch) : null;
  }
  return null;
}

function History({ history, onBack, onResume, onDelete }) {
  const sorted = [...history].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px 80px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 13.5 }}>
        <ArrowLeft size={15} /> กลับ
      </button>
      <h2 className="tk-teko" style={{ fontSize: 34, marginBottom: 4 }}>ประวัติการสร้างทัวร์นาเมนต์</h2>
      <p style={{ color: C.muted, fontSize: 13.5, marginBottom: 22 }}>ดูและกลับไปทำต่อกับทัวร์นาเมนต์ที่เคยสร้างไว้</p>

      {sorted.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13.5, textAlign: "center", padding: 40, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
          ยังไม่มีประวัติการสร้างทัวร์นาเมนต์
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((h) => {
          const champion = getTournamentChampion(h);
          const formatInfo = FORMATS.find((f) => f.id === h.format);
          return (
            <div key={h.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{h.sport === "basketball" ? "🏀" : "⚽"} {h.name || "ทัวร์นาเมนต์ไม่มีชื่อ"}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {formatInfo ? formatInfo.name : h.format} · {(h.teams || []).length} ทีม · {new Date(h.createdAt || Date.now()).toLocaleDateString("th-TH")}
                </div>
              </div>
              {champion ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.amber, fontSize: 12.5, fontWeight: 700 }}>
                  <Trophy size={14} /> {champion.name}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: C.muted }}>{(h.matches || []).length > 0 ? "กำลังแข่งขัน" : "ยังไม่เริ่มแข่ง"}</div>
              )}
              <Button variant="subtle" onClick={() => onResume(h)}>เปิดดู</Button>
              <button onClick={() => onDelete(h.id)} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", padding: 6 }}><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TOURNAMENT SCREEN
--------------------------------------------------------- */
function Tournament({ teams, setTeams, format, sport, matches, setMatches, onReset, tournamentName }) {
  const [tab, setTab] = useState("matches");
  const [activeMatch, setActiveMatch] = useState(null);
  
  // เพิ่ม State สำหรับเปิด Modal แก้ไขทีม
  const [editingTeam, setEditingTeam] = useState(null); 

  const teamById = (id) => teams.find((t) => t.id === id);
  const unit = sport === "basketball" ? "แต้ม" : "ประตู";

  const saveResult = (updated) => {
    let list = matches.map((m) => (m.id === updated.id ? updated : m));
    if (format === "knockout" || updated.group === "KO") {
      const winner = updated.tieWinner || (updated.scoreA > updated.scoreB ? updated.teamAId : updated.teamBId);
      const nextRound = updated.round + 1;
      const nextSlot = Math.floor(updated.slot / 2);
      list = list.map((m) => {
        if (m.group === updated.group && m.round === nextRound && m.slot === nextSlot) {
          const copy = { ...m };
          if (updated.slot % 2 === 0) copy.teamAId = winner; else copy.teamBId = winner;
          return copy;
        }
        return m;
      });
    }
    setMatches(list);
    setActiveMatch(null);
  };

  // แมตช์รอบแบ่งกลุ่ม (ไม่รวมรอบคัดออกที่ต่อยอดมาจากกลุ่ม)
  const groupMatches = format === "group" ? matches.filter((m) => m.group && m.group !== "KO") : [];
  const koMatches = format === "group" ? matches.filter((m) => m.group === "KO") : [];
  const allGroupDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === "done");

  const startKnockoutStage = () => {
    const names = [...new Set(groupMatches.map((m) => m.group))].sort();
    let qualifiers = [];
    names.forEach((g) => {
      const ids = teams.filter((t) => groupMatches.some((m) => m.group === g && (m.teamAId === t.id || m.teamBId === t.id))).map((t) => t.id);
      const standings = computeStandings(ids, groupMatches.filter((m) => m.group === g));
      qualifiers.push(...standings.slice(0, 2).map((s) => s.teamId));
    });
    if (qualifiers.length < 2) return;
    const bracket = makeBracket(qualifiers).map((m) => ({ ...m, group: "KO" }));
    setMatches([...matches, ...bracket]);
    setTab("koBracket");
  };

  const groupNames = format === "group" ? [...new Set(groupMatches.map((m) => m.group))].sort() : [null];
  const rounds = format === "knockout" ? [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b) : [];
  const koRounds = [...new Set(koMatches.map((m) => m.round))].sort((a, b) => a - b);
  const maxRound = rounds.length ? Math.max(...rounds) : null;
  const koMaxRound = koRounds.length ? Math.max(...koRounds) : null;
  const finalMatch = format === "knockout" ? matches.find((m) => m.round === maxRound) : null;
  const koFinalMatch = format === "group" ? koMatches.find((m) => m.round === koMaxRound) : null;

  const winnerOf = (m) => (m ? teamById(m.tieWinner || (m.scoreA > m.scoreB ? m.teamAId : m.teamBId)) : null);
  const champion =
    format === "knockout"
      ? (finalMatch && finalMatch.status === "done" ? winnerOf(finalMatch) : null)
      : (koFinalMatch && koFinalMatch.status === "done" ? winnerOf(koFinalMatch) : null);

  const roundLabel = (r) => {
    const size = rounds.length;
    const remaining = size - r + 1;
    if (remaining === 1) return "รอบชิงชนะเลิศ";
    if (remaining === 2) return "รอบรองชนะเลิศ";
    if (remaining === 3) return "รอบก่อนรองชนะเลิศ";
    return `รอบ ${r}`;
  };

  const koRoundLabel = (r) => {
    const size = koRounds.length;
    const remaining = size - r + 1;
    if (remaining === 1) return "รอบชิงชนะเลิศ";
    if (remaining === 2) return "รอบรองชนะเลิศ";
    if (remaining === 3) return "รอบก่อนรองชนะเลิศ";
    return `รอบ ${r}`;
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <h2 className="tk-teko" style={{ fontSize: 30 }}>{sport === "basketball" ? "🏀" : "⚽"} {tournamentName || "ทัวร์นาเมนต์ของคุณ"}</h2>
        <div style={{ display: "flex", gap: 10 }}>
          {/* เพิ่มปุ่มแก้ไขทีมตรงนี้ */}
          <Button variant="subtle" onClick={() => setEditingTeam(teams[0])}>
            <Pencil size={14} /> จัดการทีม/เปลี่ยนตัว
          </Button>
          <Button variant="ghost" onClick={onReset}><RotateCcw size={14} /> เริ่มใหม่</Button>
        </div>
      </div>

      {champion && (
        <div style={{
          background: `linear-gradient(135deg, ${C.amberDim}, transparent)`, border: `1px solid ${C.amber}55`,
          borderRadius: 14, padding: 22, marginBottom: 20, textAlign: "center",
          boxShadow: "0 0 40px rgba(253,176,34,0.14)",
        }}>
          <Trophy size={32} color={C.amber} style={{ marginBottom: 8, filter: "drop-shadow(0 0 10px rgba(253,176,34,0.5))" }} />
          <div className="tk-teko" style={{ fontSize: 30, color: C.amber, letterSpacing: 0.5 }}>{champion.name} คือแชมป์!</div>
        </div>
      )}

      {format === "group" && koMatches.length === 0 && allGroupDone && (
        <div style={{
          background: `linear-gradient(135deg, ${C.amberDim}, transparent)`, border: `1px solid ${C.amber}55`,
          borderRadius: 14, padding: 20, marginBottom: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, color: C.text, marginBottom: 12, fontWeight: 700 }}>
            รอบแบ่งกลุ่มจบแล้ว! พร้อมเข้าสู่รอบคัดออก (2 ทีมอันดับต้นของแต่ละกลุ่ม)
          </div>
          <Button onClick={startKnockoutStage}><Trophy size={16} /> เริ่มรอบคัดออก</Button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 22, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
        {["matches", format === "knockout" ? "bracket" : "standings", ...(koMatches.length > 0 ? ["koBracket"] : []), "players"].map((tId) => {
          const labels = { matches: "การแข่งขัน", bracket: "สายการแข่งขัน", standings: "ตารางคะแนน", koBracket: "รอบคัดออก", players: "สถิติผู้เล่น" };
          const active = tab === tId;
          return (
            <button key={tId} onClick={() => setTab(tId)} style={{
              padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13.5, fontWeight: 700,
              background: active ? C.amber : "transparent", color: active ? "#1A1300" : C.muted, border: `1px solid ${active ? C.amber : C.border}`,
            }}>{labels[tId]}</button>
          );
        })}
      </div>

      {tab === "matches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {format === "knockout"
            ? rounds.map((r) => (
                <div key={r}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10 }}>{roundLabel(r)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {matches.filter((m) => m.round === r).map((m) => (
                      <MatchCard key={m.id} match={m} teamA={teamById(m.teamAId)} teamB={teamById(m.teamBId)} onClick={() => setActiveMatch(m)} />
                    ))}
                  </div>
                </div>
              ))
            : groupNames.map((g) => (
                <div key={g || "all"}>
                  {g && <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10 }}>กลุ่ม {g}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {matches.filter((m) => m.group === g).map((m) => (
                      <MatchCard key={m.id} match={m} teamA={teamById(m.teamAId)} teamB={teamById(m.teamBId)} onClick={() => setActiveMatch(m)} />
                    ))}
                  </div>
                </div>
              ))}
        </div>
      )}

      {tab === "standings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groupNames.map((g) => {
            const ids = g ? teams.filter((t) => matches.some((m) => m.group === g && (m.teamAId === t.id || m.teamBId === t.id))).map((t) => t.id) : teams.map((t) => t.id);
            const rows = computeStandings(ids, matches.filter((m) => (g ? m.group === g : true)));
            return (
              <div key={g || "all"}>
                {g && <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10 }}>กลุ่ม {g}</div>}
                <StandingsTable rows={rows} teamById={teamById} />
              </div>
            );
          })}
        </div>
      )}

      {tab === "bracket" && (
        <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 10 }}>
          {rounds.map((r) => (
            <div key={r} style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>{roundLabel(r)}</div>
              {matches.filter((m) => m.round === r).map((m) => (
                <MatchCard key={m.id} match={m} teamA={teamById(m.teamAId)} teamB={teamById(m.teamBId)} onClick={() => setActiveMatch(m)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "koBracket" && (
        <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 10 }}>
          {koRounds.map((r) => (
            <div key={r} style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, textAlign: "center" }}>{koRoundLabel(r)}</div>
              {koMatches.filter((m) => m.round === r).map((m) => (
                <MatchCard key={m.id} match={m} teamA={teamById(m.teamAId)} teamB={teamById(m.teamBId)} onClick={() => setActiveMatch(m)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "players" && <PlayerStatsList stats={computePlayerStats(teams, matches)} teamById={teamById} unit={unit} />}

      {activeMatch && (
        <MatchModal
          match={activeMatch}
          teamA={teamById(activeMatch.teamAId)}
          teamB={teamById(activeMatch.teamBId)}
          sport={sport}
          onClose={() => setActiveMatch(null)}
          onSave={saveResult}
          onUpdateTeam={(teamId, updater) => setTeams(teams.map((t) => (t.id === teamId ? updater(t) : t)))}
        />
      )}

      {/* เพิ่ม Modal แก้ไขทีม ตรงนี้ */}
      {editingTeam && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,7,12,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 className="tk-teko" style={{ fontSize: 24 }}>เลือกทีมที่ต้องการแก้ไข</h3>
              <button onClick={() => setEditingTeam(null)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={24} /></button>
            </div>
            
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => setEditingTeam(t)} style={{
                  padding: "8px 16px", borderRadius: 8, border: `1px solid ${editingTeam.id === t.id ? C.amber : C.border}`,
                  background: editingTeam.id === t.id ? C.amberDim : C.surface, color: C.text, cursor: "pointer", whiteSpace: "nowrap"
                }}>
                  {t.name}
                </button>
              ))}
            </div>

            <TeamEditor 
              team={editingTeam} 
              onUpdate={(updatedTeam) => {
                setEditingTeam(updatedTeam);
                setTeams(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
              }} 
              onRemove={() => alert("ระบบไม่อนุญาตให้ลบทีมทิ้งระหว่างการแข่งขัน")}
            />
            
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => setEditingTeam(null)}><Check size={16} /> เสร็จสิ้น</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   APP ROOT
--------------------------------------------------------- */
export default function App() {
  const [screen, setScreen] = useStickyState("home", "app_screen");
  const [format, setFormat] = useStickyState(null, "app_format");
  const [sport, setSport] = useStickyState("football", "app_sport");
  const [teams, setTeams] = useStickyState([], "app_teams");
  const [numGroups, setNumGroups] = useStickyState(2, "app_numGroups");
  const [matches, setMatches] = useStickyState([], "app_matches");
  const [tournamentName, setTournamentName] = useStickyState("", "app_tournamentName");
  const [history, setHistory] = useStickyState([], "app_history");
  const [currentId, setCurrentId] = useStickyState(null, "app_currentId");

  // บันทึก/อัปเดตทัวร์นาเมนต์ปัจจุบันลงในประวัติทุกครั้งที่มีการเปลี่ยนแปลง
  React.useEffect(() => {
    if (!currentId) return;
    setHistory((prev) => {
      const idx = prev.findIndex((h) => h.id === currentId);
      const now = Date.now();
      const snapshot = { id: currentId, name: tournamentName, sport, format, teams, matches, numGroups, updatedAt: now };
      if (idx === -1) return [...prev, { ...snapshot, createdAt: now }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...snapshot };
      return copy;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, tournamentName, sport, format, teams, matches, numGroups]);

  const reset = () => {
    if (window.confirm("คุณต้องการลบข้อมูลการแข่งขันทั้งหมดและเริ่มใหม่ใช่หรือไม่?")) {
      setScreen("home"); setFormat(null); setTeams([]); setMatches([]); setNumGroups(2);
      setTournamentName(""); setCurrentId(null);
    }
  };

  const startNewTournament = (f, s, name) => {
    setFormat(f); setSport(s); setTournamentName(name);
    setTeams([]); setMatches([]); setNumGroups(2);
    setCurrentId(uid());
    setScreen("setup");
  };

  const resumeTournament = (h) => {
    setCurrentId(h.id); setTournamentName(h.name || ""); setFormat(h.format); setSport(h.sport);
    setTeams(h.teams || []); setMatches(h.matches || []); setNumGroups(h.numGroups || 2);
    setScreen((h.matches || []).length > 0 ? "tournament" : "setup");
  };

  const deleteHistoryEntry = (id) => {
    setHistory(history.filter((h) => h.id !== id));
    if (id === currentId) { setCurrentId(null); }
  };

  return (
    <div style={{
      minHeight: "100vh", color: C.text,
      background: `radial-gradient(ellipse 900px 480px at 50% -8%, rgba(253,176,34,0.09), transparent 60%),
                   radial-gradient(ellipse 700px 420px at 105% 8%, rgba(52,211,153,0.055), transparent 60%),
                   ${C.bg}`,
      backgroundAttachment: "fixed",
    }}>
      <FontStyles />
      {screen === "home" && (
        <Home
          onStart={startNewTournament}
          onShowHistory={() => setScreen("history")}
          historyCount={history.length}
        />
      )}
      {screen === "history" && (
        <History
          history={history}
          onBack={() => setScreen("home")}
          onResume={resumeTournament}
          onDelete={deleteHistoryEntry}
        />
      )}
      {screen === "setup" && (
        <TeamSetup
          teams={teams} setTeams={setTeams} format={format}
          numGroups={numGroups} setNumGroups={setNumGroups}
          onBack={() => setScreen("home")}
          onNext={() => setScreen("draw")}
        />
      )}
      {screen === "draw" && (
        <Draw
          teams={teams} format={format} numGroups={numGroups}
          onBack={() => setScreen("setup")}
          onConfirm={(preview) => { setMatches(preview.matches); setScreen("tournament"); }}
        />
      )}
      {screen === "tournament" && (
        <Tournament 
          teams={teams} 
          setTeams={setTeams} 
          format={format} 
          sport={sport} 
          matches={matches} 
          setMatches={setMatches} 
          onReset={reset} 
          tournamentName={tournamentName}
        />
      )}
    </div>
  );
}