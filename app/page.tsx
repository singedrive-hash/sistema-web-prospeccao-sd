"use client";

import { useMemo, useState } from "react";

type Prospect = {
  company: string;
  city: string;
  sector: string;
  employees: string;
  score: number;
  source: string;
  status: string;
};

const seed: Prospect[] = [
  { company: "Transportadora Vale Sul", city: "Joinville/SC", sector: "Logística", employees: "51–200", score: 92, source: "Google Maps", status: "Novo" },
  { company: "Grupo Industrial Norte", city: "Joinville/SC", sector: "Indústria", employees: "201–500", score: 88, source: "Google Maps", status: "Novo" },
  { company: "Construtora Horizonte", city: "Araquari/SC", sector: "Construção", employees: "51–200", score: 81, source: "LinkedIn", status: "Novo" },
  { company: "Serviços Médicos Prime", city: "Joinville/SC", sector: "Saúde", employees: "11–50", score: 74, source: "Google Maps", status: "Novo" }
];

export default function Home() {
  const [query, setQuery] = useState("empresas em Joinville com potencial para 2+ veículos");
  const [running, setRunning] = useState(false);
  const [prospects, setProspects] = useState(seed);
  const [filter, setFilter] = useState("Todos");

  const filtered = useMemo(
    () => prospects.filter((p) => filter === "Todos" || p.status === filter),
    [prospects, filter]
  );

  function createCampaign() {
    setRunning(true);
    window.setTimeout(() => {
      setProspects((current) => [...current, {
        company: "Nova campanha — exemplo",
        city: "São José/SC",
        sector: "Serviços",
        employees: "51–200",
        score: 79,
        source: "Google Maps",
        status: "Novo"
      }]);
      setRunning(false);
    }, 700);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">S</div>
          <div><strong>Sign&Drive</strong><span>Prospecção B2B</span></div>
        </div>
        <nav>
          <button className="navItem active">Hoje</button>
          <button className="navItem">Campanhas</button>
          <button className="navItem">Prospects</button>
          <button className="navItem">Pipeline</button>
          <button className="navItem">Configurações</button>
        </nav>
        <div className="sideFoot">Thema Assinaturas</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">CENTRAL DE PROSPECÇÃO</p>
            <h1>O que vamos prospectar hoje?</h1>
          </div>
          <div className="statusPill"><span /> MVP</div>
        </header>

        <section className="heroCard">
          <textarea value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="actionRow">
            <div className="chips">
              <span className="chip">Google Maps</span>
              <span className="chip">LinkedIn</span>
              <span className="chip">Brasil</span>
            </div>
            <button className="primary" onClick={createCampaign} disabled={running}>
              {running ? "Preparando..." : "Criar campanha"}
            </button>
          </div>
        </section>

        <section className="stats">
          <div><span>Prospects</span><strong>{prospects.length}</strong></div>
          <div><span>Qualificados</span><strong>{prospects.filter(p => p.score >= 80).length}</strong></div>
          <div><span>Score médio</span><strong>{Math.round(prospects.reduce((a,b) => a+b.score, 0)/prospects.length)}</strong></div>
          <div><span>Campanha</span><strong>{running ? "Em execução" : "Pronta"}</strong></div>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">FILA DE PROSPECTS</p><h2>Contas para trabalhar</h2></div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>Todos</option>
              <option>Novo</option>
              <option>Contato</option>
              <option>Oportunidade</option>
            </select>
          </div>
          <div className="table">
            {filtered.map((p, i) => (
              <article className="prospect" key={i}>
                <div className="company"><strong>{p.company}</strong><span>{p.sector} · {p.city}</span></div>
                <div className="meta"><span>{p.employees}</span><span>{p.source}</span></div>
                <div className={"score " + (p.score >= 85 ? "high" : "")}>{p.score}</div>
                <button className="contact" onClick={() => setProspects(ps => ps.map((x,idx)=>idx===i?{...x,status:"Contato"}:x))}>Trabalhar</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}