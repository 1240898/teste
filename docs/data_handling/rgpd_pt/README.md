# LaPrizza — Regulamento Geral sobre a Proteção de Dados (RGPD)

A presente documentação descreve a forma como os dados pessoais são tratados na aplicação LaPrizza, identifica as responsabilidades associadas ao seu tratamento e estabelece os procedimentos a adotar em caso de violação de dados pessoais.

O principal objetivo é promover a transparência, a responsabilização e a proteção dos dados pessoais em todas as operações realizadas no âmbito da aplicação.

## 1. Enquadramento

A **LaPrizza** é uma aplicação de gestão de restauração desenvolvida no âmbito do Projeto Integrador do 5.º semestre da Licenciatura em Engenharia Informática do Instituto Superior de Engenharia do Porto (ISEP).

A aplicação disponibiliza funcionalidades como a gestão de clientes, a administração do catálogo de produtos, a autenticação e autorização de utilizadores, a gestão de stocks e outras operações relacionadas com a atividade do restaurante.

Uma vez que estas funcionalidades envolvem o tratamento de dados pessoais, o projeto contempla os requisitos estabelecidos pelo **Regulamento (UE) 2016/679 do Parlamento Europeu e do Conselho, de 27 de abril de 2016**, designado por Regulamento Geral sobre a Proteção de Dados (RGPD).

## 2. Documentação

A documentação relativa à proteção de dados pessoais encontra-se organizada nos seguintes ficheiros:

| Documento | Descrição |
|---|---|
| [Política de Privacidade](politicaPrivacidade.md) | Documento destinado aos utilizadores, que explica de que forma a LaPrizza trata e protege os seus dados pessoais. |
| [GDP01 — Tratamento de Dados Pessoais](tratamento-dados-pessoais.md) | Identificação dos dados pessoais tratados pela aplicação e descrição das respetivas operações de tratamento. |
| [GDP02 — Responsabilidade pelo Tratamento de Dados](responsavel-processamento-dados.md) | Identificação do responsável pelo tratamento e definição das responsabilidades associadas ao tratamento de dados pessoais. |
| [GDP03 — Gestão de Violações de Dados Pessoais](protocolo-data-breach.md) | Definição de violação de dados pessoais e descrição das obrigações de notificação e comunicação, dos respetivos destinatários, da informação exigida e dos prazos aplicáveis. |

A documentação será complementada por um vídeo explicativo, no qual será apresentado o funcionamento geral da aplicação, descrito o fluxo de tratamento dos dados pessoais e explicado o protocolo de atuação em caso de violação de dados pessoais.

## 3. Princípios Relativos ao Tratamento de Dados Pessoais

A LaPrizza compromete-se a orientar o tratamento de dados pessoais pelos princípios estabelecidos no artigo 5.º do RGPD, bem como pelos deveres de transparência previstos nos artigos 12.º a 14.º:

- **Princípio da Licitude:** Os dados pessoais devem ser tratados de forma lícita, em conformidade com a legislação aplicável em matéria de proteção de dados pessoais, nomeadamente o RGPD.
- **Princípio da Lealdade:** O dados pessoais devem ser tratados de forma lícita, leal e transparente.
- **Princípio da Transparência:** Os titulares dos dados devem receber informações claras, concisas, transparentes e facilmente acessíveis sobre o tratamento dos seus dados pessoais, utilizando uma linguagem simples e clara.
- **Princípio da Finalidade:** Os dados pessoais devem ser recolhidos para finalidades determinadas, explícitas e legítimas, não podendo ser posteriormente tratados de uma forma incompatível com essas finalidades.
- **Princípio da Minimização dos Dados:** O tratamento deve limitar-se aos dados pessoais adequados, pertinentes e necessários para as finalidades a que se destinam.
- **Princípio da Exatidão:** Os dados pessoais devem ser exatos e, sempre que necessário, atualizados, devendo ser adotadas medidas adequadas para que os dados obsoletos sejam apagados ou retificados sem demora.
- **Princípio da Limitação da Conservação:** Os dados pessoais devem ser conservados apenas durante o período necessário para as finalidades para as quais são tratados, sem prejuízo das exceções legalmente previstas.
- **Princípio da Integridade e Confidencialidade:** Os dados pessoais devem ser tratados de forma a garantir a sua segurança, incluindo a proteção contra o tratamento não autorizado ou ilícito e contra a sua perda, destruição ou danificação acidental, mediante a adoção de medidas técnicas e organizativas adequadas.
- **Princípio da Responsabilidade:** O responsável pelo tratamento deve assegurar o cumprimento dos princípios relativos ao tratamento de dados pessoais e ser capaz de demonstrar essa conformidade.

## 4. User Stories Relacionadas com o RGPD

Os requisitos de proteção de dados pessoais definidos para o Sprint 2 encontram-se organizados em três User Stories.

### GDP01 — Tratamento de Dados Pessoais

**Objetivo:** Identificar e documentar os dados pessoais tratados pela aplicação LaPrizza.

A documentação contempla:

- A descrição do âmbito e das principais funcionalidades da aplicação.
- A identificação das categorias de dados pessoais tratados.
- A descrição da forma como os dados pessoais são recolhidos, utilizados, armazenados e sujeitos a outras operações de tratamento.

### GDP02 — Responsabilidade pelo Tratamento de Dados

**Objetivo:** Identificar a entidade responsável pela determinação das finalidades e dos meios de tratamento dos dados pessoais.

A documentação contempla:

- A identificação do responsável pelo tratamento dos dados pessoais.
- O esclarecimento das responsabilidades associadas ao tratamento desses dados.

### GDP03 — Gestão de Violações de Dados Pessoais

**Objetivo:** Explicar os procedimentos e as obrigações legais aplicáveis em caso de violação de dados pessoais suscetível de implicar um elevado risco para os direitos e liberdades das pessoas singulares.

A documentação contempla:

- A definição de violação de dados pessoais.
- A identificação das obrigações de notificação e comunicação aplicáveis.
- A identificação das entidades e dos titulares a quem devem ser dirigidas as notificações ou comunicações.
- A especificação das informações que devem constar das notificações e comunicações.
- A identificação dos prazos legalmente estabelecidos.

## 5. Integração com os Mecanismos de Segurança da Aplicação

A proteção dos dados pessoais é assegurada através de mecanismos de autenticação, autorização e segurança da infraestrutura da aplicação.

### User Stories relevantes do Sprint 2

| User Story | Relação com a Proteção de Dados Pessoais |
|---|---|
| AA01 — Autenticação Local | Proteção das credenciais de autenticação geridas pela aplicação. |
| AA02 — Integração com Fornecedores Externos de Identidade | Autenticação segura através de fornecedores externos de identidade. |
| AA04 — Gestão Segura de Sessões | Proteção das sessões autenticadas dos utilizadores. |
| AA05 — Controlo de Autorizações | Prevenção do acesso não autorizado a dados pessoais. |
| AA06 — Atribuição de Perfis de Acesso e Convites de Ativação | Gestão controlada das permissões dos utilizadores e dos processos de ativação de contas. |
| SYS08 — Estratégia de Cópias de Segurança e Validação da Recuperação | Proteção, conservação e recuperação da informação armazenada, incluindo dados pessoais. |

Estes mecanismos contribuem para a proteção dos dados pessoais tratados pela aplicação. Contudo, a sua implementação, por si só, não garante o cumprimento integral das obrigações estabelecidas pelo RGPD.

## 6. Enquadramento Legal e Referências

A presente documentação tem por base a legislação aplicável em matéria de proteção de dados pessoais, bem como as orientações das autoridades competentes:

- [Regulamento (UE) 2016/679 — Regulamento Geral sobre a Proteção de Dados (RGPD)](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pt)
- [Lei n.º 58/2019, de 8 de agosto — Assegura a execução do RGPD na ordem jurídica nacional](https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982)
- [Comité Europeu para a Proteção de Dados (CEPD)](https://www.edpb.europa.eu/)
- [Comissão Nacional de Proteção de Dados (CNPD)](https://www.cnpd.pt/)

## 7. Manutenção e Atualização da Documentação

A documentação relativa ao RGPD deverá ser revista e atualizada sempre que sejam introduzidas alterações na aplicação que afetem:

- As categorias de dados pessoais recolhidos.
- As finalidades ou os fundamentos de licitude do tratamento.
- Os mecanismos de autenticação e autorização.
- Os procedimentos de armazenamento, conservação ou eliminação de dados pessoais.
- Os serviços externos envolvidos no tratamento de dados pessoais.
- As medidas de segurança ou os procedimentos de resposta a violações de dados pessoais.

A documentação deverá distinguir as funcionalidades já implementadas das medidas previstas ou em desenvolvimento, garantindo que a informação apresentada corresponde ao funcionamento efetivo do sistema.