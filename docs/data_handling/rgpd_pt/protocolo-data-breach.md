# GDP03 - Gestão de Violações de Dados Pessoais

Este protocolo aplica-se aos dados pessoais tratados pela LaPrizza no cenário do projeto. A LaPrizza avalia o risco, decide se deve notificar e assegura o envio das notificações. 
## O que constitui uma violação

Uma violação de dados pessoais ocorre quando uma falha de segurança causa, de forma acidental ou ilícita, a destruição, perda, alteração, divulgação ou acesso não autorizados a dados pessoais tratados pela organização (artigo 4.º, n.º 12, do [RGPD][rgpd]). Pode afetar a confidencialidade, a integridade, a disponibilidade ou várias delas ao mesmo tempo.

Na LaPrizza, a divulgação indevida de uma ficha de cliente compromete a confidencialidade, uma alteração indevida das intolerâncias registadas compromete a integridade e a perda de acesso aos dados de clientes após uma falha compromete a disponibilidade. Um pedido de acesso recusado, por si só, é um sinal a investigar. Para o classificar como violação é preciso verificar se houve impacto sobre dados pessoais.

## Avaliação e resposta inicial

1. **Sinalizar e registar.** Quem detetar o incidente alerta de imediato o ponto de contacto interno designado pela LaPrizza. Registar separadamente a hora da deteção e a hora em que a LaPrizza obteve um grau razoável de certeza de que o incidente comprometeu dados pessoais. É a partir desse conhecimento que se conta o prazo do artigo 33.º. Se um subcontratante tomar conhecimento de uma violação, deve avisar a LaPrizza sem demora injustificada (artigo 33.º, n.º 2).
2. **Conter e preservar a evidência.** A equipa técnica restringe o acesso afetado, preserva os registos relevantes com acesso limitado e apura quais os dados e pessoas abrangidos. Se for preciso restaurar dados, seguir o procedimento de backup e confirmar a integridade antes de retomar o serviço.
3. **Avaliar o risco para as pessoas.** Ponderar a probabilidade e a gravidade das consequências, considerando o tipo e a sensibilidade dos dados, a possibilidade de identificar os titulares, o número de pessoas afetadas, quem recebeu os dados e as proteções efetivamente aplicadas. Procurar consequências concretas, como fraude, discriminação ou exposição de informação de saúde. Rever a avaliação à medida que surgem novos factos. [Orientações 9/2022 do CEPD][edpb]
4. **Decidir, comunicar e acompanhar.** A LaPrizza aplica as regras abaixo, regista o fundamento da decisão e acompanha o caso até à conclusão das medidas corretivas. O ponto de contacto coordena a resposta e presta esclarecimentos. Caso exista encarregado da proteção de dados, deve ser envolvido na avaliação.

## Destinatários e prazos

| Avaliação da violação | À autoridade de controlo | Aos titulares afetados |
|---|---|---|
| É improvável que resulte num risco para os direitos e liberdades | Dispensada. Registar a justificação. | Dispensada. |
| É suscetível de resultar num risco, sem indicação de elevado risco | Notificar. | Dispensada enquanto a avaliação se mantiver. |
| É suscetível de implicar um elevado risco | Notificar. | Comunicar, salvo uma das condições do artigo 34.º, n.º 3. |

- **Autoridade de controlo (artigo 33.º).** A LaPrizza, deve notificar a **CNPD** pelo formulário disponibilizado na [página de violações de dados da CNPD][cnpd], sem demora injustificada e, sempre que possível, até **72 horas após tomar conhecimento**. A contagem inclui fins de semana e feriados. Se a informação ainda estiver incompleta, enviar o que já se sabe e complementar por fases sem demora injustificada. Se ultrapassar as 72 horas, enviar a notificação e indicar os motivos do atraso.
- **Titulares afetados (artigo 34.º).** Em caso de elevado risco, comunicar **sem demora injustificada**, em linguagem clara e simples, por um meio direto e seguro sempre que possível. O prazo de 72 horas refere-se à notificação à autoridade. A comunicação aos titulares avança em paralelo, assim que possível.

O artigo 34.º, n.º 3, permite dispensar a comunicação direta quando medidas previamente aplicadas aos dados afetados os tornam incompreensíveis a pessoas não autorizadas, por exemplo cifragem cuja chave permaneceu protegida, ou quando medidas posteriores garantem que o elevado risco já não é suscetível de se concretizar. Se a comunicação direta implicar um esforço desproporcionado, é exigida uma comunicação pública ou medida igualmente eficaz. A CNPD pode exigir a comunicação aos titulares nos termos do n.º 4. [RGPD, artigos 33.º e 34.º][rgpd]

## Conteúdo mínimo

| À CNPD (artigo 33.º, n.º 3) | Aos titulares (artigo 34.º, n.º 2) |
|---|---|
| Natureza da violação e, quando possível, categorias e número aproximado de titulares afetados e categorias e número aproximado de registos em causa. | O que aconteceu e que dados da pessoa foram afetados, em linguagem clara e simples. |
| Nome e contactos do encarregado da proteção de dados ou de outro ponto de contacto. | Nome e contactos do encarregado da proteção de dados ou de outro ponto de contacto. |
| Consequências prováveis para as pessoas. | Consequências prováveis para a pessoa. |
| Medidas adotadas ou propostas para remediar a violação e reduzir os efeitos negativos. | Medidas adotadas ou propostas para remediar a violação e reduzir os efeitos negativos. Incluir recomendações práticas de proteção quando úteis. |

Registar **todas** as violações, incluindo as que dispensam notificação (artigo 33.º, n.º 5). Guardar num registo de acesso restrito os factos, a cronologia, os efeitos, a avaliação e as suas revisões, as medidas corretivas e a decisão relativa a cada destinatário. Quando houver comunicação ou notificação, conservar o conteúdo, as horas de envio e os comprovativos disponíveis.

## Exemplo de divulgação de fichas de cliente

Neste exemplo fictício, um destinatário externo recebe por engano um ficheiro com 120 fichas de clientes. O ficheiro inclui nomes, telefones, e-mails e intolerâncias alimentares. O destinatário confirma que abriu o ficheiro, mas a equipa não consegue confirmar que as cópias foram eliminadas.

| Momento ilustrativo (hora de Lisboa, UTC+0) | Resposta esperada |
|---|---|
| Sexta-feira, 09:30 | A equipa recebe o alerta, regista a deteção e investiga. |
| Sexta-feira, 10:00 | A LaPrizza confirma que foi aberto um ficheiro com dados pessoais. Regista o conhecimento da violação, pede a eliminação das cópias e preserva a evidência. |
| Sexta-feira, 12:00 | A exposição de informação de saúde associada a pessoas identificáveis, com possibilidade de discriminação e contactos fraudulentos, sustenta a avaliação de elevado risco. A LaPrizza notifica a CNPD e começa a comunicar diretamente aos titulares. |
| Segunda-feira, 10:00 | Completam-se 72 horas desde o conhecimento. A notificação inicial já foi enviada. Qualquer informação em falta deve ser enviada sem demora injustificada à medida que for apurada. |

Na notificação à CNPD, indicar aproximadamente 120 titulares e 120 fichas de cliente, os dados envolvidos, as consequências, as medidas de contenção e o contacto designado. Aos clientes, explicar a divulgação dos dados de contacto e das intolerâncias, as consequências prováveis, o pedido de eliminação das cópias e como contactar a LaPrizza. Recomendar atenção a mensagens ou chamadas inesperadas que aparentem vir do restaurante.

[rgpd]: https://eur-lex.europa.eu/eli/reg/2016/679/pt
[cnpd]: https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/
[edpb]: https://www.cnpd.pt/media/vfhpxp3p/edpb_guidelines_202209_personal_data_breach_notification_v2-0_pt.pdf
