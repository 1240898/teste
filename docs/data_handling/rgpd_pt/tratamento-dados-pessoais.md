# GDP01 — Tratamento de Dados Pessoais

## 1. Enquadramento e Âmbito

- **User Story:** GDP01
- **Sprint:** Sprint 2
- **Área:** RGPD, Conformidade e Proteção de Dados (GDP)
- **Responsáveis:** Todos os membros — Sofia Carvalho (1240898), Francisco Sá (1241341), Leonor de Moura (1240914), Mariana Moreira (1240905)
- **User Stories relacionadas:** GDP02 (responsável pelo tratamento), GDP03 (violações de dados), AA01–AA07 (autenticação e autorização), SYS08 (cópias de segurança), WEB03 (aviso de privacidade público)

> **Enquanto** Representante da LaPrizza,
> **pretendo** garantir que a equipa sabe como o projeto trata os dados pessoais,
> **para que** todas as operações sobre dados cumpram a legislação de proteção de dados aplicável.

| CA | Critério de aceitação | Secção |
|---|---|---|
| CA1 | Explicar de forma clara e concisa o âmbito do projeto e as suas funcionalidades principais | 2 |
| CA2 | Identificar os dados pessoais tratados | 3, 5 |
| CA3 | Descrever a forma como esses dados são tratados | 4, 6, 7, 8 |

**Legenda de estado** usada ao longo do documento:

- **Implementado** — existe no código na referência acima.
- **Previsto** — decidido pela equipa, ainda por implementar (ver 9).
- **Não recolhido** — excluído deliberadamente (minimização dos dados).

## 2. Âmbito do Projeto e Funcionalidades Principais

A LaPrizza é um sistema de informação para a gestão de uma pizzaria. É composto por uma Single-Page Application em React, uma API REST em Express com base de dados PostgreSQL, um visualizador 3D da cozinha que corre no browser e um serviço de planeamento em Prolog.

| Funcionalidade | Trata dados pessoais? |
|---|---|
| Contas e autenticação (email/palavra-passe e conta Google), perfis, ativação de contas, recuperação de palavra-passe e sessões | **Sim** |
| Gestão de clientes e autosserviço do cliente | **Sim** |
| Catálogo de produtos, categorias, catálogo de alergénios, tamanhos e componentes de pizza, pizzas predefinidas | Não — apenas dados de negócio |
| Informação e histórico de stock | Não |
| Configuração da cozinha e visualização 3D | Não |
| Planeamento com IA (lista de materiais, planeamento de necessidades, seleção de fornecedores) | Não — usa apenas dados de stock, receitas e fornecedores |
| Encomendas, pagamentos e faturação | Não implementado neste incremento |

**Titulares dos dados:** clientes (com ou sem conta), colaboradores (Administrator, Manager, Employee) e visitantes das páginas públicas (apenas o endereço IP, de forma transitória).

## 3. Inventário de Dados Pessoais

| # | Dado | Titulares | Origem | Armazenamento | Obrigatório | Estado |
|---|---|---|---|---|---|---|
| 1 | Nome | Clientes e colaboradores com conta de utilizador| Formulário de registo, convite, conta Google, formulário de cliente do Manager | `users.name`, `customers.name` | Sim | Implementado |
| 2 | Endereço de email | Clientes, colaboradores e destinatários de convites de ativação | Idem | `users.email`, `customers.email`, `activation_invitations.intended_email` | Sim | Implementado |
| 3 | Palavra-passe (apenas o hash) | Contas locais | Registo, ativação, alteração/recuperação de palavra-passe | `users.password_hash` | Só contas locais | Implementado |
| 4 | Identificador da conta Google | Contas Google | Google OpenID Connect | `user_external_identities` | Só contas Google | Implementado |
| 5 | Perfis e estado da conta | Todos os utilizadores | Sistema / Administrator | `users.roles`, `users.active`, `users.ever_activated`, `role_change_records` | Sim | Implementado |
| 6 | Consentimento de marketing e respetiva data | Clientes | Formulário de registo | `users.marketing_consent_given`, `users.marketing_consent_timestamp` | Opcional (por omissão: não) | Implementado |
| 7 | Sessões e tokens de segurança (hashes) | Todos os utilizadores | Sistema | `application_sessions`, `password_recovery_tokens`, `activation_invitations` | Sim | Implementado |
| 8 | Número de telemóvel | Clientes | Formulário de cliente do gestor, formulário de registo local ou formulário de conclusão do perfil | `customers.phone_number` | Sim, para criar a ficha de cliente | Implementado |
| 9 | Alergénios e restrições alimentares que revelem dados de saúde | Clientes | Os meus dados ou formulário da ficha de cliente | `customers.dietary_restrictions`, `customer_dietary_restriction_allergens`, `customers.health_data_consent_given`, `customers.health_data_consent_timestamp` | Opcional, com consentimento explícito | Implementado |
| 10 | Endereço IP associado a pedidos de início de sessão | Pessoas que tentam iniciar sessão, com ou sem conta | Pedido HTTP de início de sessão | Memória da aplicação, numa janela de 15 minutos, para limitar a frequência dos pedidos | Recolhido automaticamente | Implementado |
| 11 | Eventos de auditoria de segurança da AA05, incluindo o identificador e os perfis do utilizador quando disponíveis | Pessoas cujos pedidos à API são recusados | Verificações de autenticação e autorização | PostgreSQL `security_audit_logs` | Registo automático das recusas abrangidas | Implementado |

## 4. Tratamento de Dados

O fundamento de licitude é determinado pela finalidade do tratamento. A conservação segue o prazo legal ou regulamentar aplicável ou, na sua ausência, o tempo necessário à finalidade, de acordo com o artigo 5.º, n.º 1, alínea e), do RGPD e o artigo 21.º da Lei n.º 58/2019. A designação «Eliminação» refere-se à operação sobre os dados. O artigo 17.º do RGPD designa o direito do titular como «direito ao apagamento». [RGPD][rgpd] · [Lei n.º 58/2019][lei58]

### 4.1. Nome

- **Recolha** — Obtido no registo, no processo de convite, na autenticação com Google ou no preenchimento da ficha de cliente pelo gestor.
- **Armazenamento** — Guardado em `users.name` ou `customers.name`.
- **Organização** — Associado à conta de utilizador ou à ficha de cliente. A ficha pode existir sem conta associada.
- **Alteração** — O utilizador pode corrigir o nome na ficha de cliente.
- **Consulta** — O utilizador consulta o nome na sua conta. O administrador e o gestor consultam os registos das contas e das fichas de cliente, respetivamente, no âmbito das suas permissões.
- **Utilização** — Identificar o titular na gestão da conta ou da ficha de cliente e melhorar a experiência do utilizador.
- **Apagamento** — Eliminar o nome da conta ou da ficha quando deixar de ser necessário e não existir fundamento para o conservar. O procedimento de eliminação da conta está previsto.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD para identificar o cliente quando tal seja necessário à prestação do serviço contratado ou a diligências pré-contratuais pedidas pelo cliente. [RGPD][rgpd]

### 4.2. Endereço de e-mail

- **Recolha** — Obtido no registo, no processo de convite de ativação, na autenticação com Google ou no preenchimento da ficha de cliente.
- **Armazenamento** — Guardado em `users.email`, `customers.email` ou `activation_invitations.intended_email`.
- **Organização** — Associado à conta, à ficha ou ao convite para o qual foi fornecido.
- **Alteração** — O endereço de e-mail é apresentado apenas para leitura em «Os meus dados». O cliente pode pedir a sua retificação e pode editar diretamente o nome e o número de telemóvel.
- **Consulta** — O titular pode consultar o seu endereço. A consulta interna é limitada às pessoas autorizadas a gerir contas, fichas ou convites.
- **Utilização** — Identificar a conta, enviar convites e mensagens de recuperação e contactar o cliente quando necessário. O envio de mensagens de ativação e recuperação utiliza o serviço de correio eletrónico da aplicação.
- **Apagamento** — Eliminar o endereço dos registos que deixem de ser necessários. Os convites expirados devem ter um prazo de conservação próprio, dado que o endereço pode continuar a ser necessário na conta ou na ficha.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD quando o endereço seja necessário para disponibilizar ou recuperar uma conta pedida pelo cliente ou para prestar o serviço. [RGPD][rgpd]

### 4.3. Palavra-passe

- **Recolha** — O utilizador introduz a palavra-passe no registo, na ativação, na alteração ou na recuperação da conta local.
- **Geração e armazenamento do hash** —A aplicação gera um hash com `bcrypt` e guarda-o em `users.password_hash`, associado à conta.
- **Alteração** — A definição de uma nova palavra-passe gera um novo hash, que substitui o anterior.
- **Utilização** — Na autenticação, a aplicação consulta o hash guardado para verificar a palavra-passe apresentada.
- **Apagamento** — O hash deve ser removido quando a credencial local deixar de ser necessária ou quando os dados da conta forem eliminados.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD para autenticar o cliente quando a credencial local seja necessária à utilização da conta contratada. Para contas de trabalho, o artigo 6.º, n.º 1, alínea f), pode fundamentar a autenticação individual, mediante avaliação. O artigo 32.º enquadra a proteção da credencial como medida de segurança. [RGPD][rgpd]

### 4.4. Identificador da conta Google

- **Recolha** — Obtido através de OpenID Connect quando o utilizador escolhe autenticar-se com Google.
- **Armazenamento** — O identificador, o fornecedor e a data da associação são guardados em `user_external_identities`.
- **Organização** — A combinação do fornecedor e do identificador externo é associada à conta LaPrizza.
- **Utilização** — Reconhecer a conta LaPrizza correspondente nos acessos com Google.
- **Apagamento** — Eliminar a associação quando deixar de ser necessária para a autenticação com Google ou no âmbito da eliminação da conta.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD para o cliente, se guardar a associação for necessário para disponibilizar o método de autenticação que pediu no âmbito do serviço. [RGPD][rgpd]

### 4.5. Perfis e estado da conta

- **Recolha** — O sistema atribui os valores iniciais na criação da conta. A ativação, a desativação e as decisões do administrador geram atualizações.
- **Armazenamento** — Os valores atuais são guardados em `users.roles`, `users.active` e `users.ever_activated`. O histórico de alterações de perfil é guardado em `role_change_records`.
- **Organização** — Os valores atuais ficam associados à conta. O histórico identifica a conta afetada, o interveniente e a data da alteração.
- **Alteração** — O administrador pode alterar os perfis. Os processos de ativação e desativação atualizam o estado da conta.
- **Consulta** — Os componentes de autorização consultam os perfis e o estado da conta. O acesso ao histórico deve ficar reservado às pessoas autorizadas a realizar a auditoria.
- **Utilização** — Aplicar permissões, determinar se a conta pode aceder ao sistema e investigar alterações de acesso.
- **Apagamento** — Eliminar os dados da conta quando deixarem de ser necessários. Aplicar ao histórico de auditoria um prazo de conservação próprio.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD para os dados necessários a disponibilizar o acesso contratado pelo cliente. O artigo 6.º, n.º 1, alínea f), é uma base a avaliar para a gestão de permissões de colaboradores e para o histórico de auditoria, atendendo à necessidade de proteger o sistema e ao impacto sobre os titulares. [RGPD][rgpd]

### 4.6. Consentimento de marketing

- **Recolha** — O cliente indica a sua decisão numa opção separada, desmarcada por omissão, no formulário de registo.
- **Armazenamento** — A decisão e a respetiva data são guardadas em `users.marketing_consent_given` e `users.marketing_consent_timestamp`.
- **Organização** — A decisão fica associada à conta e à finalidade de marketing.
- **Alteração** — O cliente pode dar ou retirar o consentimento na sua ficha de cliente.
- **Consulta** — O cliente pode consultar a sua preferência. O acesso interno deve limitar-se às pessoas que verificam a autorização ou a prova da decisão.
- **Utilização** — Determinar se o cliente autorizou o envio de comunicações de marketing e demonstrar a decisão tomada.
- **Apagamento** — Cessar os envios baseados no consentimento após a sua retirada. Eliminar o registo da decisão quando deixar de ser necessário conservá-lo como prova.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea a), e artigo 7.º do RGPD para o marketing baseado no consentimento. O artigo 7.º regula também a prova e a retirada do consentimento. Para comunicações eletrónicas de marketing direto, aplica-se ainda o artigo 13.º-A da Lei n.º 41/2004. A eventual conservação da prova após a retirada deve ter finalidade, fundamento e prazo próprios. [RGPD][rgpd] · [Lei n.º 41/2004, artigo 13.º-A][lei41]

### 4.7. Sessões e tokens de segurança

- **Recolha** — A aplicação gera as credenciais ao criar uma sessão, emitir um convite de ativação ou iniciar a recuperação de uma palavra-passe.
- **Armazenamento** — Os hashes são guardados em `application_sessions`, `activation_invitations` ou `password_recovery_tokens`, conforme o fluxo.
- **Organização** — Cada registo fica associado à conta, à finalidade e aos dados necessários para determinar a sua validade.
- **Alteração** — As sessões podem ser renovadas ou terminadas. Os tokens de uso único são invalidados após a utilização ou deixam de poder ser utilizados quando expiram.
- **Utilização** — Manter sessões autenticadas, validar a ativação de contas e confirmar pedidos de recuperação.
- **Apagamento** — As sessões terminadas ficam sujeitas ao prazo de conservação configurado, de sete dias por omissão. O prazo de conservação de convites e tokens de recuperação expirados deve ser definido separadamente da sua validade.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD para as operações necessárias à utilização da conta do cliente. O artigo 6.º, n.º 1, alínea f), é uma base a avaliar para a gestão de acessos internos ou para a conservação adicional de registos necessária à segurança. O artigo 32.º enquadra as medidas técnicas de proteção das credenciais. [RGPD][rgpd]

### 4.8. Número de telemóvel

- **Recolha** — Fornecido no formulário da ficha de cliente. É pedido no registo local ou na conclusão do perfil.
- **Armazenamento** — Guardado em `customers.phone_number`.
- **Organização** — Associado à ficha de cliente e, quando exista uma ligação, acessível através da conta correspondente.
- **Alteração** — O utilizador pode corrigir o número na ficha. 
- **Consulta** — O utilizador consulta o número na ficha. A consulta interna é limitada às pessoas autorizadas a gerir contas.
- **Utilização** — Contactar o cliente quando necessário à prestação do serviço.
- **Apagamento** — Eliminar o número quando deixar de ser necessário para o contacto que justificou a recolha.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea b), do RGPD se o contacto telefónico for objetivamente necessário para prestar o serviço. Se essa necessidade surgir apenas numa operação posterior, a minimização prevista no artigo 5.º, n.º 1, alínea c), aponta para a recolha nessa fase.[RGPD][rgpd]

### 4.9. Alergénios e restrições alimentares que revelem dados de saúde

- **Recolha** — O cliente fornece a informação voluntariamente, após dar consentimento explícito.
- **Armazenamento** — As restrições são guardadas em `customers.dietary_restrictions`. As ligações ao catálogo de alergénios são guardadas em `customer_dietary_restriction_allergens`.
- **Organização** — Cada restrição fica associada à ficha de cliente e pode estar relacionada com um alergénio do catálogo.
- **Alteração** — O cliente corrige ou remove a informação que forneceu e pode retirar o consentimento.
- **Consulta** — O cliente consulta os seus próprios dados. O gestor pode consultar e registar restrições quando necessário à prestação do serviço e pode adicioná-las ou alterá-las no formulário depois de confirmar o consentimento explícito do cliente.
- **Utilização** — Identificar restrições relevantes para a seleção e preparação dos produtos destinados ao cliente.
- **Apagamento** — Ao retirar o consentimento, a aplicação apaga em conjunto as restrições e as ligações ao catálogo. A migração `0030` apaga as restrições antigas e as ligações sem consentimento explícito registado e mantém os restantes dados da ficha.
- **Fundamento de licitude** — Para o modelo proposto, o artigo 6.º, n.º 1, alínea a), do RGPD estabelece o consentimento como fundamento de licitude. O artigo 9.º, n.º 2, alínea a), estabelece a condição adicional de consentimento explícito para tratar dados de saúde. Esta base pressupõe que o consentimento seja efetivamente obtido e demonstrável, conforme o artigo 7.º. [RGPD][rgpd]

### 4.10. Endereço IP associado a pedidos de início de sessão

- **Recolha** — Obtido automaticamente a partir do pedido HTTP, incluindo pedidos de pessoas sem conta.
- **Armazenamento** — O endereço IP e o contador de pedidos são mantidos em memória pelo mecanismo de limitação.
- **Organização** — O endereço IP é utilizado como chave para associar os pedidos à respetiva janela de limitação.
- **Alteração** — A cada pedido abrangido, o sistema atualiza o contador associado ao endereço IP.
- **Utilização** — Limitar a frequência de pedidos de início de sessão e reduzir o abuso do serviço de autenticação.
- **Apagamento** — O registo temporário expira segundo a janela configurada de 15 minutos. A auditoria persistente da aplicação e os registos de bloqueios de rede têm prazos próprios.
- **Fundamento de licitude** — Artigo 6.º, n.º 1, alínea f), do RGPD, se o responsável demonstrar que o tratamento é necessário para proteger o serviço de autenticação e que os direitos dos titulares não prevalecem.  [RGPD][rgpd]

### 4.11. Auditoria de segurança da AA05

A API regista as recusas de autenticação, permissão e acesso a recursos de outro titular para apoiar investigações. Cada evento inclui os identificadores do evento e do pedido, data e hora, resultado, método HTTP, modelo da rota, código da resposta e, quando disponíveis, o identificador e os perfis do utilizador. O administrador pode consultar a auditoria. O modelo da rota omite os identificadores incorporados no URL e as query strings.

## 5. Dados Não Recolhidos (Minimização)

A folha de cálculo preliminar da equipa listava dados que o sistema não recolhe:

| Dado | Decisão |
|---|---|
| Data de nascimento | **Não recolhida.** Não existe produto com restrição de idade nem funcionalidade de aniversário que a justifique. |
| Dados bancários ou de cartão | **Não recolhidos e nunca guardados.** Quando existirem pagamentos, serão delegados num prestador de pagamentos. |
| Moradas | **Não recolhidas.** O aviso de privacidade público tem de ser corrigido |
| Número de Identificação Fiscal|**Não recolhido.** Apesar de ser um dado que pretendemos recolher, nesta etapa ainda não temos serviço de pagamentos|
| Histórico de encomendas e pagamentos | Não tratado neste incremento, porque as encomendas não estão implementadas. Será documentado quando estiverem. |

---

## 6. Prazos de Conservação

Para formular os prazos de conservaçaõ que serão seguidos, foi utilizado como base o art. 21.º da Lei n.º 58/2019 que define as regras: os dados são conservados pelo prazo fixado por norma legal ou, na falta desta, pelo necessário para a finalidade. Depois disso devem ser destruídos ou anonimizados (n.º 4), e o apagamento só pode ser exercido depois de terminado um eventual prazo legal de conservação (n.º 5).

| N.º | Dado | Prazo ou critério de conservação | 
|---|---|---|
| 1 | Nome | Na conta, enquanto for necessário para gerir o acesso. Na ficha de cliente, enquanto for necessário à relação comercial. Rever as fichas após 24 meses sem atividade relevante e eliminar ou anonimizar os dados cuja finalidade tenha cessado. | 
| 2 | Endereço de e-mail | Na conta e na ficha, enquanto for necessário à respetiva finalidade. Para os convites de ativação, propõe-se apagar o registo 30 dias após a expiração, utilização ou revogação. A conservação do endereço na conta segue um prazo próprio. |
| 3 | Palavra-passe (hash) | Conservar apenas o hash atual enquanto existir uma credencial local utilizável. Substituir o hash na alteração da palavra-passe e eliminá-lo quando a credencial for definitivamente removida. |
| 4 | Identificador da conta Google | Enquanto a associação for necessária para autenticação. Eliminar quando a identidade externa for desvinculada ou quando a conta for definitivamente encerrada. | 
| 5 | Perfis e estado da conta | Conservar os valores atuais enquanto forem necessários à gestão da conta. Para o histórico de alterações de permissões, propor 90 dias após cada evento, com conservação adicional limitada aos registos necessários para investigar um incidente concreto. | 
| 6 | Consentimento de marketing e respetiva data | Conservar a preferência ativa enquanto for usada para gerir o marketing. Após a retirada, cessar os envios e conservar apenas a informação mínima necessária para respeitar a preferência ou demonstrar a decisão. Definir um prazo próprio com base nessa necessidade e revê-lo anualmente. | 
| 7 | Sessões e tokens de segurança | Sessões terminadas: sete dias por omissão. Propõe-se apagar os registos dos tokens de recuperação no prazo de 24 horas após a utilização, expiração ou revogação, e os convites de ativação após 30 dias, incluindo o hash do token. |
| 8 | Número de telemóvel | Enquanto for necessário para contactar o cliente sobre o serviço. Eliminar quando essa finalidade cessar e aplicar à ficha a revisão após 24 meses sem atividade relevante. | 
| 9 | Alergénios e restrições alimentares que revelem dados de saúde | Enquanto a informação for necessária à finalidade indicada e existir consentimento explícito válido. Eliminar as restrições e as respetivas associações quando o consentimento for retirado ou a finalidade cessar, salvo se existir fundamento autónomo e condição válida para a sua conservação. | 
| 10 | Endereço IP associado a pedidos de início de sessão | Manter o endereço IP e o contador em memória durante a janela de limitação de 15 minutos. Os registos persistentes de auditoria e de bloqueios de rede têm prazos próprios. |
| 11 | Eventos de auditoria de segurança da AA05 | Persistentes em PostgreSQL. O prazo de conservação e a rotina de eliminação ainda estão por definir. |

A revisão após 24 meses é um momento de verificação. A eliminação deve ocorrer mais cedo se a finalidade já tiver cessado. Os prazos de 24 horas e de 30 dias são propostas que aguardam uma rotina de eliminação automática. A proposta de 90 dias acima refere-se ao histórico de alterações de perfis. A validade de uma credencial, o fim da sessão e a eliminação do respetivo registo são acontecimentos distintos.

---

## 7. Medidas Técnicas e Organizativas (arts. 25.º e 32.º)

- Palavras-passe guardadas com hash bcrypt. Credenciais de sessão, tokens de recuperação e tokens de convite guardados apenas como hash.
- As operações de gestão de clientes exigem `MANAGER`. As rotas `/customers/me` exigem `CUSTOMER` e usam a conta autenticada. Em `GET /customers/:id`, o `MANAGER` pode consultar qualquer ficha e o `CUSTOMER` pode consultar a própria ficha. A gestão de utilizadores e a consulta da auditoria de segurança exigem `ADMINISTRATOR`. O acesso é negado por omissão.
- Os logs HTTP usam os modelos de rota e omitem as query strings.
- As respostas da API de clientes levam `Cache-Control: no-store`, para que os dados pessoais não fiquem em cache.
- Mensagens genéricas em falhas de login e limitação de pedidos nos endpoints públicos.
- Validação dos dados na API (Joi), nos value objects do domínio e em restrições `CHECK` da base de dados. Consultas SQL parametrizadas.
- Segredos (`JWT_SECRET`, credenciais da base de dados e do SMTP) guardados em ficheiros `.env` que nunca são versionados.
- As cópias de segurança e as reposições protegem os dados pessoais e respeitam os pedidos de apagamento já concluídos.
- Proteção de dados por defeito: os consentimentos de marketing e de alergénios vêm desmarcados e os dados opcionais não são exigidos para criar conta.

### Verificação da integração

O serviço de clientes limita a edição de contacto em autosserviço à ficha da conta autenticada e grava apenas o nome e o telemóvel. As alterações ao consentimento, às restrições e às ligações a alergénios são executadas numa transação PostgreSQL. O formulário WEB05 envia o consentimento quando o gestor confirma a decisão do cliente para novas restrições ou alterações.

Os testes de integração aplicam a migração a uma ficha antiga com um alergénio associado e verificam que a ficha continua disponível na API sem as restrições antigas. Um teste concorrente confirma que uma edição de contacto pode terminar após a retirada do consentimento sem repor restrições ou ligações. Os testes da SPA cobrem a confirmação no formulário de criação e edição, bem como o pedido enviado quando se alteram apenas os contactos.

---

## 8. Referências

- [Regulamento (UE) 2016/679 (RGPD)](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pt) — arts. 4.º (ponto 15), 5.º, 6.º, 7.º, 9.º, 12.º a 22.º, 25.º, 30.º e 32.º
- [Lei n.º 58/2019, de 8 de agosto](https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982) — arts. 16.º, 18.º e 21.º
- Código do IVA — art. 36.º (conteúdo das faturas) e art. 52.º (conservação durante 10 anos)
- [CNPD](https://www.cnpd.pt/)

[rgpd]: https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=CELEX:32016R0679
[lei58]: https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982
[lei41]: https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2004-106523049-183878511
[civa36]: https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/pages/iva36.aspx
[civa52]: https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/pages/iva52.aspx
