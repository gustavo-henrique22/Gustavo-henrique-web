const ArrowUpRight = ({ size = 18 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7" /><path d="M7 7h10v10" />
  </svg>
);

const CodeIcon = () => (
  <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" />
  </svg>
);

const LayersIcon = () => (
  <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />
  </svg>
);

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#inicio" aria-label="Início">GH<span>.</span></a>
        <nav aria-label="Navegação principal">
          <a href="#projetos">Projetos</a>
          <a href="#sobre">Sobre</a>
          <a className="nav-cta" href="https://wa.me/5511989735670?text=Ol%C3%A1%2C%20Gustavo!%20Vi%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar%20sobre%20um%20site." target="_blank" rel="noreferrer">WhatsApp</a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow reveal delay-1"><span className="status-dot" />Desenvolvedor em formação · São Paulo, SP</div>
          <h1 className="reveal delay-2">Ideias simples.<br /><em>Grandes resultados.</em></h1>
          <p className="hero-intro reveal delay-3">
            Eu sou <strong>Gustavo Henrique</strong>. Estou me desenvolvendo como profissional e já trabalho em projetos reais — de landing pages a sites para pequenos negócios.
          </p>
          <div className="hero-actions reveal delay-4">
            <a className="primary-button" href="#projetos">Ver meus projetos <ArrowUpRight /></a>
            <a className="text-link" href="#sobre">Mais sobre mim <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <div className="hero-mark reveal delay-3" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="mark-core"><span>GH</span><small>PORTFÓLIO / 01</small></div>
          <span className="coordinate coordinate-top">23°32&apos;S</span>
          <span className="coordinate coordinate-bottom">46°37&apos;W</span>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div><span>DESENVOLVIMENTO WEB</span><b>✦</b><span>INTERFACES</span><b>✦</b><span>SITES RESPONSIVOS</span><b>✦</b><span>CONSTRUA SUA MARCA</span><b>✦</b><span>DESENVOLVIMENTO WEB</span><b>✦</b><span>INTERFACES</span></div>
      </div>

      <section className="section projects-section" id="projetos">
        <div className="section-heading">
          <p className="section-number">01 / PROJETOS</p>
          <h2>Construindo enquanto aprendo.</h2>
          <p>Meu portfólio ainda é pequeno — e está crescendo projeto por projeto, com curiosidade, prática e atenção aos detalhes.</p>
        </div>

        <div className="project-list">
          <article className="project-card featured-project">
            <div className="project-index">01</div>
            <div className="project-visual landing-visual" aria-hidden="true">
              <div className="browser-shell">
                <div className="browser-top"><i /><i /><i /></div><div className="mock-nav" />
                <div className="mock-copy"><span /><span /><span /><button tabIndex={-1}>PEDIR AGORA</button></div>
                <div className="mock-image">✦</div>
              </div>
            </div>
            <div className="project-content">
              <div className="project-meta"><span>Sites para negócios locais</span><span className="project-status practice">Disponível</span></div>
              <h3>Landing pages que ajudam a vender</h3>
              <p>Crio páginas diretas, bonitas e responsivas para apresentar serviços, gerar contatos e dar mais confiança para pequenos negócios na internet.</p>
              <ul className="tag-list" aria-label="Tecnologias e temas"><li>HTML</li><li>CSS</li><li>JavaScript</li><li>UI/UX</li></ul>
            </div>
          </article>

          <article className="project-card compact-project">
            <div className="project-index">02</div>
            <div className="project-visual web-visual" aria-hidden="true">
              <div className="code-window">
                <div className="code-top"><i /><i /><i /><span>seu-site.tsx</span></div>
                <div className="code-lines"><span>01&nbsp; const ideia =</span><b>&quot;sua presença online&quot;</b><span>03&nbsp; transformar(ideia)</span><span>04&nbsp; .em um site real</span><em>05&nbsp; publicado ✓</em></div>
              </div>
            </div>
            <div className="project-content">
              <div className="project-meta"><span>Outros serviços digitais</span><span className="project-status practice">Disponível</span></div>
              <h3>Sites institucionais e portfólios</h3>
              <p>Crio sites para apresentar empresas, profissionais, eventos e produtos com clareza — incluindo portfólios, catálogos e cardápios digitais responsivos.</p>
              <ul className="tag-list" aria-label="Tipos de serviço"><li>Sites institucionais</li><li>Portfólios</li><li>Catálogos digitais</li><li>Cardápios digitais</li></ul>
            </div>
          </article>

          <article className="project-card compact-project">
            <div className="project-index">03</div>
            <div className="project-visual saas-visual" aria-hidden="true">
              <div className="saas-window">
                <div className="saas-top"><b>✓</b><span>Recebi.</span></div>
                <div className="saas-stats"><span><small>Recebido</small>R$ 8.420</span><span className="saas-dark"><small>Sobra livre</small>R$ 6.105</span></div>
                <div className="saas-bars"><i style={{ height: "45%" }} /><i style={{ height: "60%" }} /><i style={{ height: "52%" }} /><i style={{ height: "74%" }} /><i style={{ height: "66%" }} /><i style={{ height: "90%" }} /></div>
              </div>
            </div>
            <div className="project-content">
              <div className="project-meta"><span>Produto próprio · SaaS</span><span className="project-status practice">No ar</span></div>
              <h3>Recebi: finanças para freelancers</h3>
              <p>Um sistema completo para freelancers e MEIs controlarem receitas e despesas, enviarem cobranças com Pix e acompanharem lucro, impostos e o limite do MEI.</p>
              <ul className="tag-list" aria-label="Recursos"><li>Login e planos</li><li>Banco de dados</li><li>Pix com QR Code</li><li>Relatórios</li></ul>
              <a className="project-link" href="/recebi">Conhecer o Recebi <ArrowUpRight size={16} /></a>
            </div>
          </article>
        </div>
      </section>

      <section className="section process-section" id="processo">
        <div className="section-heading process-heading">
          <p className="section-number">02 / COMO FUNCIONA</p>
          <h2>Da sua ideia ao site no ar.</h2>
          <p>Um processo simples e próximo, para você acompanhar cada etapa e saber exatamente o que está sendo feito.</p>
        </div>
        <ol className="process-grid">
          <li><span>01</span><h3>Você conta sua ideia</h3><p>Conversamos sobre seu negócio, seus objetivos e o tipo de site que você precisa.</p></li>
          <li><span>02</span><h3>Eu preparo o projeto</h3><p>Organizo o conteúdo e desenvolvo uma primeira versão com identidade e clareza.</p></li>
          <li><span>03</span><h3>Revisamos juntos</h3><p>Você acompanha o resultado e me diz quais detalhes gostaria de ajustar.</p></li>
          <li><span>04</span><h3>Seu site vai ao ar</h3><p>Depois da aprovação, deixo tudo pronto para seus clientes encontrarem você.</p></li>
        </ol>
        <div className="process-cta">
          <p>Tem uma ideia em mente?</p>
          <a className="primary-button" href="https://wa.me/5511989735670?text=Ol%C3%A1%2C%20Gustavo!%20Vi%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar%20sobre%20um%20site." target="_blank" rel="noreferrer">Conversar pelo WhatsApp <ArrowUpRight /></a>
        </div>
      </section>

      <section className="section now-section" id="agora">
        <div className="section-heading compact-heading"><p className="section-number">03 / AGORA</p><h2>O que estou construindo.</h2></div>
        <div className="now-grid">
          <article><span className="now-icon"><CodeIcon /></span><p className="card-kicker">DESENVOLVIMENTO</p><h3>Do zero até a tela</h3><p>Pratico HTML, CSS e JavaScript criando páginas que funcionam bem no computador e no celular.</p></article>
          <article><span className="now-icon"><LayersIcon /></span><p className="card-kicker">PRODUTO & INTERFACE</p><h3>Ideia com direção</h3><p>Organizo funcionalidades, estudo referências e busco interfaces com personalidade — sem perder a facilidade de uso.</p></article>
          <aside><p>PRÓXIMO PASSO</p><strong>Transformar cada estudo em um projeto melhor que o anterior.</strong><span>Aprender → construir → melhorar</span></aside>
        </div>
      </section>

      <section className="section about-section" id="sobre">
        <p className="section-number">04 / SOBRE MIM</p>
        <div className="about-grid">
          <h2>Ainda no começo,<br /><em>mas levando a sério.</em></h2>
          <div className="about-copy">
            <p>Sou um jovem desenvolvedor web de São Paulo, focado em transformar ideias em sites claros, modernos e pensados para gerar confiança. Trabalho com atenção aos detalhes, comunicação transparente e compromisso em cada etapa do projeto.</p>
            <p>Meu objetivo é ajudar negócios e profissionais a construírem uma presença digital que represente sua marca, facilite o contato com clientes e transmita profissionalismo desde o primeiro acesso.</p>
            <div className="availability"><span className="status-dot" />Portfólio em evolução constante</div>
          </div>
        </div>
      </section>

      <footer>
        <div><a className="wordmark footer-mark" href="#inicio">GH<span>.</span></a><p>Projetando, programando e aprendendo.</p></div>
        <div className="footer-nav"><a href="#projetos">Projetos</a><a href="#sobre">Sobre</a><a href="#inicio">Voltar ao topo ↑</a></div>
        <small>© 2026 Gustavo Henrique</small>
      </footer>
    </main>
  );
}
