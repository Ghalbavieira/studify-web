import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, BookOpen, CalendarDays, Check, CheckCheck,
  GraduationCap, ListChecks, MessageSquareText, RotateCcw, ShieldCheck,
  Sparkles, Target, Timer, TrendingUp, Users,
} from "lucide-react";
import { Brand } from "@/components/brand";

const cycle = [
  { title: "Plano", icon: CalendarDays, color: "text-blue", text: "Seu objetivo dividido em passos possíveis." },
  { title: "Estudo", icon: Timer, color: "text-cyan", text: "Um bloco de foco. Uma sessão de cada vez." },
  { title: "Questões", icon: ListChecks, color: "text-violet", text: "Coloque o que aprendeu à prova." },
  { title: "Revisões", icon: RotateCcw, color: "text-yellow", text: "Volte aos erros e consolide o conteúdo." },
  { title: "Desempenho", icon: TrendingUp, color: "text-green", text: "Entenda sua evolução e ajuste a rota." },
  { title: "Comunidade", icon: Users, color: "text-pink", text: "Encontre quem está na mesma caminhada." },
];
const cta = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold";
const secondaryCta = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-surface px-6 py-3 text-sm font-semibold text-foreground";
const container = "mx-auto max-w-7xl px-5 sm:px-8";

function ProductCapture({ performance = false }: { performance?: boolean }) {
  return <figure className="min-w-0">
    <div className="overflow-hidden rounded-lg border border-line bg-background-secondary shadow-[0_24px_80px_#00000040]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-xs text-muted">
        <span className="flex gap-1.5" aria-hidden="true"><span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" /></span>
        <span>studify / {performance ? "desempenho" : "início"}</span>
        <span className="size-2 rounded-full bg-green" aria-hidden="true" />
      </div>
      <Image src={performance ? "/product/studify-performance.png" : "/product/studify-home-preview.png"} width={1440} height={1000} alt={performance ? "Tela real de Desempenho do Studify, com planejado versus executado, acertos e recuperação de erros." : "Tela real do Studify com foco de hoje, botão Começar, pendências e progresso diário e semanal."} sizes={performance ? "(max-width: 1024px) 100vw, 800px" : "(max-width: 1280px) 100vw, 1216px"} preload={!performance} className="h-auto w-full" />
    </div>
    <figcaption className="mt-3 text-center text-xs text-muted">Interface real do Studify · ambiente de demonstração</figcaption>
  </figure>;
}

export default function Home() {
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-line bg-background">
      <div className={`${container} flex min-h-20 items-center justify-between gap-3 py-3`}>
        <Brand />
        <nav aria-label="Navegação principal" className="flex items-center gap-2 sm:gap-6">
          <a href="#como-funciona" className="hidden min-h-11 items-center text-sm text-secondary md:inline-flex">Como funciona</a>
          <Link href="/planos" className="hidden min-h-11 items-center text-sm text-secondary sm:inline-flex">Planos</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm text-secondary">Entrar</Link>
          <Link href="/cadastro" className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-3 text-xs font-semibold sm:px-4 sm:text-sm">Começar grátis <ArrowRight size={15} className="ml-2 hidden sm:block" /></Link>
        </nav>
      </div>
    </header>

    <section className={`${container} pb-16 pt-14 sm:pt-20 lg:pb-24 lg:pt-24`}>
      <div className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center gap-2 rounded-md border border-line bg-background-secondary px-3 py-2 text-xs font-medium text-secondary"><span className="size-1.5 rounded-full bg-cyan" />Seu objetivo. Seu ritmo. Seu próximo passo.</p>
        <h1 className="mt-7 text-[clamp(2.65rem,7vw,5.75rem)] font-semibold leading-[1.04] tracking-[-0.055em]">Pare de estudar<br /><span className="text-cyan">no escuro.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-secondary sm:text-xl sm:leading-8">Planeje, estude, resolva questões e acompanhe sua evolução em um único lugar.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/cadastro" className={cta}>Começar 15 dias grátis <ArrowRight size={18} /></Link>
          <a href="#como-funciona" className={secondaryCta}>Ver como funciona <ArrowDown size={17} /></a>
        </div>
        <p className="mt-4 text-xs text-muted">15 dias de Pro. Depois, você escolhe como continuar.</p>
      </div>
      <div className="mt-12 sm:mt-16"><ProductCapture /></div>
    </section>

    <section id="como-funciona" aria-labelledby="cycle-title" className="scroll-mt-8 border-y border-line bg-background-secondary py-16 lg:py-24">
      <div className={container}>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan">Da primeira sessão à sua próxima conquista</p>
        <h2 id="cycle-title" className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">O Studify acompanha<br className="hidden sm:block" /> sua preparação inteira.</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {cycle.map(({ title, icon: Icon, color, text }, index) => <article key={title} className="min-w-0 border-t border-line pt-5">
            <div className="flex items-center justify-between"><Icon size={24} className={color} /><span className="font-mono text-xs text-muted">0{index + 1}</span></div>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section aria-labelledby="performance-title" className={`${container} py-16 lg:py-24`}>
      <div className="grid items-center gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-14">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-green">Seu esforço, com perspectiva</p><h2 id="performance-title" className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Saiba exatamente onde você está melhorando.</h2>
          <ul className="mt-7 space-y-4">{["Planejado × executado", "Acertos", "Evolução por matéria", "Erros recuperados"].map(label => <li key={label} className="flex items-center gap-3 text-secondary"><Check size={17} className="shrink-0 text-green" />{label}</li>)}</ul>
          <p className="mt-7 text-sm leading-6 text-muted">Veja o que funcionou, o que pede atenção e o que levar para a próxima sessão.</p>
        </div>
        <ProductCapture performance />
      </div>
    </section>

    <section aria-labelledby="ai-title" className="border-y border-line bg-background-secondary py-16 lg:py-24">
      <div className={`${container} grid items-center gap-10 lg:grid-cols-2 lg:gap-20`}>
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">Clareza para continuar</p><h2 id="ai-title" className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Não só registra.<br />Ajuda você a decidir o próximo passo.</h2><p className="mt-5 max-w-lg text-base leading-7 text-secondary">O Studify conecta seu plano, suas sessões e suas respostas para orientar o que estudar agora.</p></div>
        <div className="rounded-lg border border-violet bg-surface p-6 sm:p-8"><div className="flex items-center gap-3"><span className="rounded-md bg-highlight-subtle p-2 text-violet"><Sparkles size={23} /></span><h3 className="text-lg font-semibold">Studify IA</h3></div><blockquote className="mt-6 text-xl leading-8 text-foreground">“Seu desempenho em Português caiu nas últimas sessões.<br /><br />Priorize interpretação de texto e refaça 15 questões.”</blockquote><div className="mt-6 flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-muted"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-violet" /><p>Exemplo de recomendação. As sugestões usam seus registros; você decide e confirma os ajustes.</p></div></div>
      </div>
    </section>

    <section aria-labelledby="community-title" className={`${container} py-16 lg:py-24`}>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-20"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-pink">Gente que entende o seu caminho</p><h2 id="community-title" className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Estudar sozinho não precisa ser estudar isolado.</h2><p className="mt-5 max-w-lg leading-7 text-secondary">Troque aprendizados, compartilhe os dias de progresso e encontre pessoas que estudam com o mesmo objetivo.</p><Link href="/comunidade" className="mt-6 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-pink">Conhecer a comunidade <ArrowRight size={18} /></Link></div>
        <div className="divide-y divide-line border-y border-line">{[
          { icon: Users, title: "Grupos por concurso", text: "Encontre seu grupo e mantenha a conversa perto do seu objetivo." },
          { icon: MessageSquareText, title: "Feed", text: "Dúvidas, anotações e descobertas que fazem parte do estudo." },
          { icon: TrendingUp, title: "Compartilhamento de evolução", text: "Compartilhe uma sessão e suas conquistas com quem está junto." },
          { icon: CheckCheck, title: "Comparação com candidatos do mesmo objetivo", text: "Uma referência coletiva, com privacidade e amostra suficiente.", soon: true },
        ].map(({ icon: Icon, title, text, soon }) => <article key={title} className="flex gap-4 py-5"><Icon size={22} className="mt-1 shrink-0 text-pink" /><div><h3 className="font-semibold">{title}</h3>{soon && <span className="mt-1 inline-block rounded-sm bg-raised px-2 py-0.5 text-[11px] text-muted">Em breve</span>}<p className="mt-1 text-sm leading-6 text-muted">{text}</p></div></article>)}</div>
      </div>
    </section>

    <section aria-labelledby="goals-title" className="border-y border-line bg-background-secondary py-14 sm:py-16"><div className={container}><h2 id="goals-title" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Feito para quem estuda com objetivo.</h2><ul className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">{[[Target,"Concurso"],[GraduationCap,"Faculdade"],[ShieldCheck,"Certificações"],[BookOpen,"Provas"]].map(([Icon,label]) => { const Symbol = Icon as typeof Target; return <li key={String(label)} className="flex flex-col items-center gap-3 py-3 text-secondary"><Symbol size={26} className="text-cyan" /><span className="text-sm font-medium">{String(label)}</span></li>; })}</ul></div></section>

    <section className={`${container} py-20 text-center lg:py-28`}><span className="inline-flex rounded-lg border border-violet bg-highlight-subtle p-3 text-violet"><Sparkles size={26} /></span><h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">15 dias de Pro grátis.</h2><p className="mt-5 text-lg text-secondary">Depois continue no Free ou assine o Pro.</p><Link href="/cadastro" className={`${cta} mt-8`}>Começar 15 dias grátis <ArrowRight size={18} /></Link><Link href="/planos" className="mx-auto mt-4 flex min-h-11 w-fit items-center text-sm text-muted">Conhecer Free e Pro</Link></section>

    <footer className="border-t border-line"><div className={`${container} flex flex-col justify-between gap-6 py-8 sm:flex-row sm:items-center`}><div><Brand /><p className="mt-3 text-xs text-muted">Seu estudo com direção.</p></div><nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted"><Link href="/login" className="inline-flex min-h-11 items-center">Entrar</Link><Link href="/planos" className="inline-flex min-h-11 items-center">Planos</Link><Link href="/regras-comunidade" className="inline-flex min-h-11 items-center">Regras da comunidade</Link></nav></div></footer>
  </main>;
}
