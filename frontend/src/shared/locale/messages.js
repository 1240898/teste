import { kitchenConfigurationMessages } from './kitchenConfigurationMessages.js';
// Each interface key has Portuguese and English copy. Business data is passed
// as values and never used as a translation key.
const messages = {
  unknownMessage: [
    'Ocorreu um problema. Tente novamente.',
    'Something went wrong. Please try again.',
  ],
  configurationError: [
    'A aplicação não está configurada corretamente.',
    'The application is not configured correctly.',
  ],
  start: ['Início', 'Start'],
  availableSections: ['Secções disponíveis', 'Available sections'],
  primaryNavigation: ['Navegação principal', 'Main navigation'],
  previousSections: ['Mostrar secções anteriores', 'Show previous sections'],
  nextSections: ['Mostrar as próximas secções', 'Show next sections'],
  skipToContent: ['Saltar para o conteúdo principal', 'Skip to main content'],
  language: ['Idioma', 'Language'],
  localeNotSaved: [
    'O idioma foi alterado, mas não pôde ser guardado para a próxima visita.',
    'The language changed but could not be saved for your next visit.',
  ],
  connecting: ['A estabelecer ligação…', 'Connecting…'],
  connected: ['Ligado ao servidor', 'Connected to the server'],
  disconnected: ['Sem ligação ao servidor', 'No connection to the server'],
  retryConnection: ['Tentar ligar novamente', 'Retry connection'],
  checkingPermissions: [
    'A verificar permissões…',
    'Checking your permissions…',
  ],
  viewer: ['Visualizador da cozinha', 'Kitchen viewer'],
  viewerLoading: [
    'A carregar a configuração da cozinha…',
    'Loading the kitchen configuration…',
  ],
  viewerLoadingAssets: [
    'A carregar os modelos e as texturas 3D…',
    'Loading 3D models and textures…',
  ],
  viewerUnsupported: [
    'Este navegador não consegue apresentar conteúdo 3D (WebGL).',
    'Your browser cannot display 3D content (WebGL).',
  ],
  viewerEmpty: [
    'Não há nenhuma configuração de cozinha ativa. Um gestor tem de ativar uma.',
    'No kitchen configuration is active. A manager must activate one.',
  ],
  viewerInvalid: [
    'Não foi possível apresentar a configuração de cozinha ativa.',
    'The active kitchen configuration cannot be displayed.',
  ],
  viewerUnavailable: [
    'O visualizador da cozinha está indisponível.',
    'The kitchen viewer is unavailable.',
  ],
  viewerAssetUnavailable: [
    'O ficheiro 3D {assetId} da configuração ativa está indisponível.',
    'The 3D file {assetId} of the active configuration is unavailable.',
  ],
  viewerFailed: [
    'O visualizador 3D parou devido a um erro.',
    'The 3D viewer stopped because of an error.',
  ],
  viewerReload: ['Recarregar', 'Reload'],
  viewerResetView: ['Repor vista', 'Reset view'],
  viewerCanvas: [
    'Representação 3D da cozinha ativa',
    '3D view of the active kitchen',
  ],
  viewerVersion: ['({id}, versão {version})', '({id}, version {version})'],
  kitchenConfigurations: ['Configurações da cozinha', 'Kitchen configurations'],
  planning: ['Planeamento', 'Planning'],
  loadingSection: ['A carregar a secção…', 'Loading section…'],
  moduleLoadFailed: [
    'Não foi possível carregar esta secção.',
    'This section could not be loaded.',
  ],
  retry: ['Tentar novamente', 'Try again'],
  notFound: ['Página não encontrada', 'Page not found'],
  returnToStart: ['Voltar ao início', 'Return to Start'],
  accessDenied: ['Acesso negado', 'Access denied'],
  insufficientPermission: [
    'Não tem permissão para aceder a esta página.',
    'You do not have permission to access this page.',
  ],
  signInRequired: [
    'Inicie sessão para aceder a esta página.',
    'Please sign in to access this page.',
  ],
  inactiveAccount: ['A conta não está ativa.', 'Account is not active.'],
  noActiveRole: [
    'Esta conta não tem um perfil ativo atribuído.',
    'No active role is assigned to this account.',
  ],
  authUnconfirmed: [
    'Não foi possível confirmar as suas permissões. Inicie sessão novamente.',
    'We could not confirm your permissions. Please sign in again.',
  ],
  sessionRestoreFailed: [
    'Não foi possível restaurar a sessão. Inicie sessão novamente.',
    'Your session could not be restored. Please sign in again.',
  ],
  sessionExpired: [
    'A sessão expirou. Inicie sessão novamente.',
    'Your session expired. Please sign in again.',
  ],
  signingOut: ['A terminar sessão…', 'Signing out…'],
  retryLogout: ['Tentar terminar sessão novamente', 'Retry logout'],
  logoutUnconfirmed: [
    'Não foi possível confirmar o fim da sessão. Tente novamente.',
    'Logout could not be confirmed. Retry logout.',
  ],
  signedOut: [
    'Terminou sessão na LaPrizza. Se usou o Google, a sua conta Google continua com sessão iniciada neste navegador.',
    'You have logged out of LaPrizza. If you used Google, your Google account stays signed in on this browser.',
  ],
  welcome: ['Bem-vindo à LaPrizza', 'Welcome to LaPrizza'],
  welcomeName: ['Olá, {name}', 'Hello, {name}'],
  chooseSection: [
    'Escolha uma secção no menu para começar.',
    'Choose a section from the menu to get started.',
  ],
  signedInAs: ['Sessão iniciada como {name}.', 'You are signed in as {name}.'],
  signInTitle: ['Iniciar sessão na LaPrizza', 'Sign in to LaPrizza'],
  signIn: ['Iniciar sessão', 'Sign in'],
  signingIn: ['A iniciar sessão…', 'Signing in…'],
  signInIntro: [
    'Use o e-mail e a palavra-passe da sua conta.',
    'Use your account email and password.',
  ],
  invalidCredentials: [
    'E-mail ou palavra-passe inválidos.',
    'Invalid email or password.',
  ],
  forgotPassword: ['Esqueceu-se da palavra-passe?', 'Forgot your password?'],
  showPassword: ['Mostrar palavra-passe', 'Show password'],
  hidePassword: ['Ocultar palavra-passe', 'Hide password'],
  noAccount: ['Ainda não tem conta?', 'New to LaPrizza?'],
  or: ['ou', 'or'],
  googleHint: [
    'A primeira entrada com Google cria a conta de cliente.',
    'Google creates a customer account on first sign-in.',
  ],
  googleContinue: ['Continuar com o Google', 'Continue with Google'],
  googleCallback: [
    'A concluir o início de sessão com o Google',
    'Completing Google sign-in',
  ],
  googleUnavailable: [
    'Não é possível iniciar sessão com o Google de momento. Tente novamente.',
    'Google sign-in is not available right now. Please try again.',
  ],
  googleCancelled: [
    'O início de sessão com o Google foi cancelado. A sessão não foi iniciada.',
    'Google sign-in was cancelled. You have not been signed in.',
  ],
  googleIncomplete: [
    'Não foi possível concluir o início de sessão. Tente novamente.',
    'Sign-in could not be completed. Please try again.',
  ],
  googleFailed: [
    'Não foi possível iniciar sessão com o Google. Tente novamente ou use o e-mail e a palavra-passe.',
    'Google sign-in failed. Please try again or use local sign-in.',
  ],
  googleEmailConflict: [
    'Este e-mail já está associado a uma conta. Inicie sessão com a palavra-passe ou use o convite de ativação.',
    'This e-mail is already associated with an account. Sign in with your local credentials or use your activation invitation.',
  ],
  logout: ['Terminar sessão', 'Log out'],
  email: ['E-mail', 'Email'],
  role: ['Perfil', 'Role'],
  password: ['Palavra-passe', 'Password'],
  name: ['Nome', 'Name'],
  requiredField: ['obrigatório', 'required'],
  fieldRequired: ['Preencha este campo.', 'Fill in this field.'],
  invalidEmail: [
    'Introduza um endereço de e-mail válido.',
    'Enter a valid email address.',
  ],
  fieldTooShort: [
    'Introduza pelo menos {length} caracteres.',
    'Enter at least {length} characters.',
  ],
  invalidField: [
    'Verifique o valor neste campo.',
    'Check the value in this field.',
  ],
  passwordRules: [
    'Use pelo menos 12 caracteres, com maiúsculas, minúsculas, um algarismo e um símbolo.',
    'Use at least 12 characters, including uppercase, lowercase, a digit and a symbol.',
  ],
  passwordPolicy: [
    'Use pelo menos 12 caracteres, com maiúsculas, minúsculas, um algarismo e um símbolo, até 72 bytes em UTF-8.',
    'Use at least 12 characters, including uppercase, lowercase, a digit and a symbol, and at most 72 UTF-8 bytes.',
  ],
  createAccount: ['Criar conta', 'Create account'],
  creatingAccount: ['A criar conta…', 'Creating account…'],
  accountCreated: [
    'Conta criada. Consulte o e-mail para ver o convite de ativação.',
    'Account created. Check your email for the activation invitation.',
  ],
  accountCreatedEmailFailed: [
    'A conta foi criada, mas não foi possível enviar o e-mail de ativação. Contacte um administrador para repetir o envio.',
    'Account created but the activation email could not be delivered. Contact an administrator to retry the invitation.',
  ],
  registrationFailed: [
    'Não foi possível criar a conta. Verifique os dados e tente novamente.',
    'The account could not be created. Check the details and try again.',
  ],
  emailRegistered: [
    'O endereço de e-mail já está registado.',
    'Email already registered.',
  ],
  marketingConsent: [
    'Receber e-mails de marketing',
    'Receive marketing emails',
  ],
  recoverPassword: ['Recuperar palavra-passe', 'Recover your password'],
  recoveryIntro: [
    'Introduza o endereço de e-mail associado à sua conta.',
    'Enter the email address associated with your account.',
  ],
  recoveryRequested: [
    'Se a conta for elegível, receberá instruções de recuperação.',
    'If the account is eligible, recovery instructions will be sent.',
  ],
  recoveryInvalid: [
    'A ligação de recuperação é inválida ou expirou.',
    'Invalid or expired recovery link.',
  ],
  choosePassword: ['Escolher nova palavra-passe', 'Choose a new password'],
  currentPassword: ['Palavra-passe atual', 'Current password'],
  newPassword: ['Nova palavra-passe', 'New password'],
  confirmPassword: ['Confirmar nova palavra-passe', 'Confirm new password'],
  changePassword: ['Alterar palavra-passe', 'Change password'],
  changePasswordIntro: [
    'Confirme a sua palavra-passe atual e escolha uma diferente. {rules}',
    'Confirm your current password and choose a different password. {rules}',
  ],
  passwordMismatch: [
    'As palavras-passe não coincidem.',
    'The passwords do not match.',
  ],
  noLocalPassword: [
    'Esta conta não tem uma palavra-passe local.',
    'This account does not have a local password.',
  ],
  incorrectPassword: [
    'A palavra-passe atual está incorreta.',
    'Current password is incorrect.',
  ],
  differentPassword: [
    'A nova palavra-passe deve ser diferente da atual.',
    'Choose a different password from the current one.',
  ],
  passwordDifference: [
    'A nova palavra-passe deve diferir da atual em pelo menos quatro caracteres.',
    'The new password must differ from the current password by at least four characters.',
  ],
  passwordChanged: [
    'A sua palavra-passe foi alterada.',
    'Your password has been changed.',
  ],
  passwordChangedSignIn: [
    'A sua palavra-passe foi alterada. Inicie sessão com a nova palavra-passe.',
    'Your password has been changed. Sign in with your new password.',
  ],
  passwordChangeFailed: [
    'Não foi possível alterar a palavra-passe.',
    'The password could not be changed.',
  ],
  wait: ['Aguarde…', 'Please wait…'],
  sendLink: ['Enviar ligação', 'Send link'],
  backToSignIn: ['Voltar ao início de sessão', 'Back to sign in'],
  backToAccount: ['Voltar à conta', 'Back to account'],
  account: ['Conta', 'Account'],
  userManagement: ['Gestão de utilizadores', 'User management'],
  securityAudit: ['Registos de segurança', 'Security audit logs'],
  securityAuditIntro: [
    'Consulte tentativas de acesso negadas. Os registos não incluem palavras-passe, tokens ou conteúdo dos pedidos.',
    'Review denied access attempts. Events contain no passwords, tokens or request contents.',
  ],
  auditOutcome: ['Resultado', 'Outcome'],
  allOutcomes: ['Todos os resultados', 'All outcomes'],
  unauthenticated: ['Não autenticado', 'Unauthenticated'],
  forbidden: ['Acesso proibido', 'Forbidden'],
  ownershipDenied: ['Propriedade negada', 'Ownership denied'],
  actorId: ['ID do utilizador', 'Actor ID'],
  fromDate: ['Desde', 'From'],
  toDate: ['Até', 'To'],
  search: ['Pesquisar', 'Search'],
  loadingAuditEvents: ['A carregar registos…', 'Loading audit events…'],
  auditEventCount: ['{count} evento(s)', '{count} event(s)'],
  refresh: ['Atualizar', 'Refresh'],
  noAuditEvents: ['Não foram encontrados registos.', 'No audit events found.'],
  auditTime: ['Data e hora', 'Time'],
  auditRequest: ['Pedido', 'Request'],
  auditStatus: ['Estado HTTP', 'Status'],
  auditActor: ['Utilizador', 'Actor'],
  auditRoles: ['Papéis', 'Roles'],
  requestId: ['ID do pedido', 'Request ID'],
  previous: ['Anterior', 'Previous'],
  next: ['Seguinte', 'Next'],
  auditShowingRange: [
    'A mostrar {start}–{end} de {total}',
    'Showing {start}–{end} of {total}',
  ],
  userManagementIntro: [
    'Atribua perfis e gira a ativação de contas.',
    'Assign website roles and manage account activation.',
  ],
  inviteWorker: ['Convidar trabalhador', 'Invite worker'],
  workerRole: ['Perfil inicial', 'Initial role'],
  activationMethod: ['Método de ativação', 'Activation method'],
  activationTitle: ['Ativar conta', 'Activate account'],
  activationChecking: ['A verificar o convite…', 'Checking the invitation…'],
  activationPassword: ['Defina a sua palavra-passe', 'Set your password'],
  activationConfirm: ['Ativar conta', 'Activate account'],
  activationUseGoogle: ['Ativar com Google', 'Activate with Google'],
  activationCompleteLocal: [
    'A conta foi ativada. Já pode iniciar sessão com a sua palavra-passe.',
    'Your account is active. You can now sign in with your password.',
  ],
  activationCompleteGoogle: [
    'A conta foi ativada. Pode iniciar sessão com Google.',
    'Your account is active. You can sign in with Google.',
  ],
  activationExistingSession: [
    'Tem uma sessão aberta como {email}. Termine essa sessão para entrar com a conta que ativou.',
    'You are signed in as {email}. Sign out to use the account you just activated.',
  ],
  activationSwitchAccount: [
    'Terminar sessão e entrar com outra conta',
    'Sign out and use another account',
  ],
  activationUnavailable: [
    'Já não é possível usar este convite. Se já ativou a conta, inicie sessão. Caso contrário, peça um novo convite a um administrador.',
    'This invitation can no longer be used. If you already activated your account, sign in. Otherwise, contact an administrator for a new invitation.',
  ],
  activationFailed: [
    'Não foi possível ativar a conta. Volte a tentar ou abra novamente o convite.',
    'The account could not be activated. Try again or reopen your invitation.',
  ],
  activationGoogleFailed: [
    'Não foi possível verificar a identidade com Google. Abra novamente o convite para voltar a tentar.',
    'Google identity verification failed. Reopen your invitation to try again.',
  ],
  activationRateLimited: [
    'Demasiadas tentativas. Tente novamente mais tarde.',
    'Too many attempts. Try again later.',
  ],
  chooseActivationMethod: ['Escolha o método', 'Choose a method'],
  localActivation: ['Palavra-passe', 'Password'],
  googleActivation: ['Google', 'Google'],
  unknownActivationMethod: [
    'Método desconhecido. Escolha como a conta deve ser ativada.',
    'Activation method unknown. Choose how this account should be activated.',
  ],
  workerAccountUpdated: [
    'A conta já existente foi gerida. Não foi necessário enviar um convite de ativação.',
    'The existing account was managed. No activation invitation was needed.',
  ],
  noAccounts: ['Não foram encontradas contas.', 'No user accounts found.'],
  active: ['Ativa', 'Active'],
  inactive: ['Inativa', 'Inactive'],
  rolesFor: ['Perfis de {name}', 'Roles for {name}'],
  roleADMINISTRATOR: ['Administrador', 'Administrator'],
  roleMANAGER: ['Gestor da LaPrizza', 'LaPrizza Manager'],
  roleEMPLOYEE: ['Funcionário do restaurante', 'Restaurant Staff'],
  roleCUSTOMER: ['Cliente', 'Customer'],
  saveRoles: ['Guardar perfis', 'Save roles'],
  deactivate: ['Desativar conta', 'Deactivate account'],
  reactivate: ['Reativar conta', 'Reactivate account'],
  invite: ['Enviar ou substituir convite', 'Send or replace invitation'],
  invitationSent: [
    'Convite enviado. Expira em {date}.',
    'Invitation sent; expires {date}.',
  ],
  invitationFailed: [
    'Não foi possível enviar o convite. Pode repetir o envio nesta página.',
    'Invitation delivery failed. You can retry from this page.',
  ],
  invitationTerminalFailure: [
    'Não foi possível enviar o convite e não é possível repeti-lo nesta operação.',
    'The invitation could not be sent and cannot be retried for this attempt.',
  ],
  invitationOutcomeUnknown: [
    'Não foi possível confirmar o resultado. Um novo convite pode invalidar o anterior.',
    'The result could not be confirmed. A replacement may invalidate the previous invitation.',
  ],
  invitationReplacementWarning: [
    'O convite anterior pode deixar de funcionar. Confirma o envio de um novo convite para esta conta?',
    'The previous invitation may stop working. Send a replacement invitation for this account?',
  ],
  confirmInvitationWarning: [
    'O envio pode substituir um convite anterior para esta conta. Pretende continuar?',
    'Sending may replace a previous invitation for this account. Do you want to continue?',
  ],
  confirmDeactivateWarning: [
    'A conta será desativada e deixará de poder aceder às áreas protegidas. Pretende continuar?',
    'The account will be deactivated and lose access to protected areas. Do you want to continue?',
  ],
  confirmReactivateWarning: [
    'A conta será reativada e poderá voltar a aceder às áreas protegidas. Pretende continuar?',
    'The account will be reactivated and regain access to protected areas. Do you want to continue?',
  ],
  confirmRolesWarning: [
    'A alteração dos perfis pode conceder ou remover acesso. Pretende continuar?',
    'Changing roles may grant or remove access. Do you want to continue?',
  ],
  confirmPasswordChangeWarning: [
    'A palavra-passe será alterada e a sessão terminará. Terá de iniciar sessão novamente com a nova palavra-passe. Pretende continuar?',
    'Your password will change and your session will end. You will need to sign in again with the new password. Do you want to continue?',
  ],
  confirmAction: ['Confirmar ação', 'Confirm action'],
  confirm: ['Confirmar', 'Confirm'],
  cancel: ['Cancelar', 'Cancel'],
  retryInvitation: ['Repetir envio do convite', 'Retry invitation'],
  retryUsers: ['Tentar carregar contas novamente', 'Retry loading accounts'],
  resourceUnavailable: [
    'O recurso já não está disponível. Atualize os dados antes de continuar.',
    'This resource is no longer available. Refresh it before continuing.',
  ],
  operationConflict: [
    'A operação entrou em conflito com o estado atual. Atualize os dados antes de continuar.',
    'The operation conflicts with the current state. Refresh the data before continuing.',
  ],
  staleVersion: [
    'Os dados foram alterados por outra pessoa. Reveja os dados atuais antes de guardar.',
    'The data changed elsewhere. Review the current data before saving.',
  ],
  validationFailed: [
    'Alguns dados não foram aceites. Reveja o formulário e tente novamente.',
    'Some data was not accepted. Review the form and try again.',
  ],
  serviceUnavailable: [
    'O serviço está temporariamente indisponível. Tente novamente mais tarde.',
    'The service is temporarily unavailable. Please try again later.',
  ],
  signInAgain: [
    'A sessão já não está disponível. Inicie sessão novamente.',
    'Your session is no longer available. Please sign in again.',
  ],
  requestUnconfirmed: [
    'Não foi possível confirmar o resultado desta operação.',
    'The result of this operation could not be confirmed.',
  ],
  mutationOutcomeUnknown: [
    'Não foi possível confirmar se a operação foi aplicada. Os dados foram preservados e a repetição está bloqueada. Verifique o estado antes de tentar novamente.',
    'The operation may have been applied, but its result could not be confirmed. Your data is preserved and resubmission is blocked. Check the current state before trying again.',
  ],
  reviewCurrentDataNotice: [
    'O resultado difere dos dados submetidos. O rascunho foi preservado e as alterações ficam bloqueadas até rever os dados atuais.',
    'The result differs from the submitted data. Your draft is preserved and changes are blocked until you review the current data.',
  ],
  reviewCurrentData: ['Rever dados atuais', 'Review current data'],
  currentDataReviewed: [
    'Dados atuais revistos. Pode voltar a editar.',
    'Current data reviewed. You can edit again.',
  ],
  loadingUsers: ['A carregar contas…', 'Loading accounts…'],
  processingAction: ['A processar…', 'Processing…'],
  sendInvitation: ['Enviar convite', 'Send invitation'],
  userUpdated: ['Utilizador atualizado.', 'User updated.'],
  lastAdministrator: [
    'Tem de existir pelo menos um administrador ativo.',
    'At least one active Administrator must remain.',
  ],
  userNotFound: ['Utilizador não encontrado.', 'User not found.'],
  connectionError: [
    'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.',
    'Could not reach the server. Check your connection and try again.',
  ],
  // WEB03 (BR 4): public catalogue and product / allergen information.
  catalogue: ['Catálogo', 'Catalogue'],
  catalogueIntro: [
    'Consulte os produtos à venda, os preços e a informação sobre alergénios.',
    'Browse the products on sale, their prices and allergen information.',
  ],
  searchByComponent: [
    'Pesquisar por ingrediente da pizza',
    'Search by pizza ingredient',
  ],
  clearSearch: ['Limpar pesquisa', 'Clear search'],
  loadingCatalogue: ['A carregar o catálogo…', 'Loading the catalogue…'],
  catalogueLoadFailed: [
    'Não foi possível carregar o catálogo.',
    'The catalogue could not be loaded.',
  ],
  catalogueEmpty: [
    'Ainda não há produtos à venda.',
    'There are no products on sale yet.',
  ],
  catalogueNoMatch: [
    'Nenhum produto contém o ingrediente "{name}".',
    'No product contains the ingredient "{name}".',
  ],
  priceFrom: ['Desde {price}', 'From {price}'],
  allergens: ['Alergénios', 'Allergens'],
  allergenName1: ['Cereais que contêm glúten', 'Cereals containing gluten'],
  allergenName2: ['Crustáceos', 'Crustaceans'],
  allergenName3: ['Ovos', 'Eggs'],
  allergenName4: ['Peixe', 'Fish'],
  allergenName5: ['Amendoins', 'Peanuts'],
  allergenName6: ['Soja', 'Soybeans'],
  allergenName7: ['Leite', 'Milk'],
  allergenName8: ['Frutos de casca rija', 'Tree nuts'],
  allergenName9: ['Aipo', 'Celery'],
  allergenName10: ['Mostarda', 'Mustard'],
  allergenName11: ['Sementes de sésamo', 'Sesame seeds'],
  allergenName12: [
    'Dióxido de enxofre e sulfitos',
    'Sulphur dioxide and sulphites',
  ],
  allergenName13: ['Tremoço', 'Lupin'],
  allergenName14: ['Moluscos', 'Molluscs'],
  excludeAllergens: ['Excluir alergénios', 'Exclude allergens'],
  excludeComponents: ['Excluir componentes', 'Exclude components'],
  componentFilterHelp: [
    'A pizza tem de incluir todos os componentes selecionados.',
    'A pizza must include every selected component.',
  ],
  catalogueNoFilterMatch: [
    'Nenhum produto corresponde aos filtros selecionados.',
    'No products match the selected filters.',
  ],
  catalogueLookupFailed: [
    'Não foi possível carregar a disponibilidade e os preços desta pizza.',
    'Could not load this pizza’s availability and prices.',
  ],
  componentTypeLimitsHelp: [
    'Os novos limites aplicam-se a novas configurações ou às que forem editadas. As configurações existentes são preservadas.',
    'New limits apply to new or edited configurations. Existing configurations are preserved.',
  ],
  currentProductData: ['Dados atuais do produto', 'Current product data'],
  reviewAndContinue: [
    'Revi os dados atuais; continuar a editar',
    'I reviewed the current data; continue editing',
  ],
  customers: ['Clientes', 'Customers'],
  categories: ['Categorias', 'Categories'],
  products: ['Produtos', 'Products'],
  pizzaSizes: ['Tamanhos de pizza', 'Pizza sizes'],
  componentTypes: ['Tipos de componente', 'Component types'],
  predefinedPizzas: ['Pizzas predefinidas', 'Predefined pizzas'],
  stock: ['Stock', 'Stock'],
  componentConfigurations: ['Configurações por tamanho', 'Size configurations'],
  identifier: ['Identificador', 'Identifier'],
  description: ['Descrição', 'Description'],
  phoneNumber: ['Telefone', 'Phone number'],
  linkedUserId: ['ID de utilizador associado', 'Linked user ID'],
  dietaryRestrictions: [
    'Restrições alimentares (JSON)',
    'Dietary restrictions (JSON)',
  ],
  allergenNumber: [
    'Número de alergénio UE (1–14)',
    'EU allergen number (1–14)',
  ],
  categoryId: ['ID da categoria', 'Category ID'],
  isSellable: ['Vendável', 'Sellable'],
  isPizzaComponent: ['Componente de pizza', 'Pizza component'],
  acquisitionType: ['Tipo de aquisição', 'Acquisition type'],
  purchased: ['Comprado', 'Purchased'],
  produced: ['Produzido', 'Produced'],
  compositionItems: [
    'Composição',
    'Composition',
  ],
  compositionSelectionHelp: [
    'Escolha componentes já existentes e indique a quantidade. Para não adicionar componentes, deixe a lista vazia.',
    'Choose existing components and enter the quantity. Leave the list empty if this product has no components.',
  ],
  addCompositionProduct: ['Adicionar componente', 'Add component'],
  removeCompositionProduct: ['Remover', 'Remove'],
  refreshCompositionProducts: ['Atualizar lista de produtos', 'Refresh product list'],
  noCompositionProducts: [
    'Não há componentes de pizza ativos disponíveis. Crie um produto marcado como componente de pizza ou atualize a lista.',
    'No active pizza components are available. Create a product marked as a pizza component or refresh the list.',
  ],
  componentTypeId: ['ID do tipo de componente', 'Component type ID'],
  allergenIds: [
    'Alergénios diretos',
    'Direct allergens',
  ],
  componentTypeBaseDough: ['Massa base', 'Base Dough'],
  componentTypeBaseSauce: ['Molho base', 'Base Sauce'],
  componentTypeCheese: ['Queijo', 'Cheese'],
  componentTypeTopping: ['Cobertura', 'Topping'],
  categoryBeverages: ['Bebidas', 'Beverages'],
  categoryDesserts: ['Sobremesas', 'Desserts'],
  categoryStarters: ['Entradas', 'Starters'],
  categoryPizzaIngredients: ['Ingredientes de pizza', 'Pizza Ingredients'],
  pricingMode: ['Modo de preço', 'Pricing mode'],
  fixedPrice: ['Preço fixo', 'Fixed price'],
  componentBasedPrice: ['Baseado em componentes', 'Component based'],
  basePrice: ['Preço base (EUR)', 'Base price (EUR)'],
  pizzaSizeId: ['ID do tamanho', 'Pizza size ID'],
  assemblyOrder: ['Ordem de montagem', 'Assembly order'],
  minimumQuantity: ['Quantidade mínima', 'Minimum quantity'],
  maximumQuantity: ['Quantidade máxima', 'Maximum quantity'],
  productId: ['ID do produto', 'Product ID'],
  configurationPrice: ['Preço configurado', 'Configured price'],
  currency: ['Moeda', 'Currency'],
  stockUnitsConsumed: ['Unidades de stock consumidas', 'Stock units consumed'],
  initialUnits: ['Unidades iniciais', 'Initial units'],
  historical: ['Histórico', 'Historical'],
  availableUnits: ['Unidades disponíveis', 'Available units'],
  trackingStarted: ['Seguimento iniciado', 'Tracking started'],
  trackingEnded: ['Seguimento terminado', 'Tracking ended'],
  adjustmentDirection: ['Direção do ajuste', 'Adjustment direction'],
  stockIncrease: ['Entrada', 'Increase'],
  stockDecrease: ['Saída', 'Decrease'],
  units: ['Unidades', 'Units'],
  componentIds: ['IDs dos componentes (JSON)', 'Component IDs (JSON)'],
  composition: ['Composição', 'Composition'],
  replaceConfiguration: ['Substituir configuração', 'Replace configuration'],
  delete: ['Remover', 'Delete'],
  yes: ['Sim', 'Yes'],
  no: ['Não', 'No'],
  directAllergens: ['Diretos', 'Direct'],
  derivedAllergens: ['Derivados', 'Derived'],
  managementCreate: ['Criar', 'Create'],
  managementEdit: ['Editar', 'Edit'],
  managementSave: ['Guardar', 'Save'],
  managementCancel: ['Cancelar', 'Cancel'],
  managementSearch: ['Pesquisar', 'Search'],
  managementRefresh: ['Atualizar', 'Refresh'],
  managementNoResults: [
    'Não foram encontrados registos.',
    'No records were found.',
  ],
  managementLoadError: [
    'Não foi possível carregar os dados.',
    'Could not load the data.',
  ],
  managementSaved: ['Alterações guardadas.', 'Changes saved.'],
  managementCreated: ['Registo criado.', 'Record created.'],
  managementDeleted: ['Registo removido.', 'Record removed.'],
  managementChanged: ['Estado atualizado.', 'Status updated.'],
  managementConfirmDelete: [
    'Confirma que pretende remover este registo?',
    'Are you sure you want to remove this record?',
  ],
  managementConfirmStatus: [
    'Confirma que pretende alterar o estado deste registo?',
    'Are you sure you want to change this record status?',
  ],
  managementDetails: ['Detalhes', 'Details'],
  managementActions: ['Ações', 'Actions'],
  managementStatus: ['Estado', 'Status'],
  managementCreateTitle: ['Novo registo', 'New record'],
  managementEditTitle: ['Editar registo', 'Edit record'],
  managementRequired: ['Campo obrigatório', 'Required field'],
  managementInvalidJson: [
    'Introduza uma lista JSON válida.',
    'Enter a valid JSON list.',
  ],
  managementStartTracking: ['Iniciar seguimento', 'Start tracking'],
  managementAdjustStock: ['Ajustar stock', 'Adjust stock'],
  managementStopTracking: ['Parar seguimento', 'Stop tracking'],
  managementActivate: ['Ativar', 'Activate'],
  managementDeactivate: ['Desativar', 'Deactivate'],
  managementSelectProduct: ['ID do produto', 'Product ID'],
  managementSelectSize: ['ID do tamanho', 'Size ID'],
  managementFormError: [
    'Verifique os dados e tente novamente.',
    'Check the details and try again.',
  ],
  referenceDataFailed: [
    'Não foi possível carregar alguns dados de referência.',
    'Some reference data could not be loaded.',
  ],
  noAllergens: ['Sem alergénios declarados.', 'No declared allergens.'],
  available: ['Disponível', 'Available'],
  unavailable: ['Indisponível', 'Unavailable'],
  productDetails: ['Detalhe do produto', 'Product details'],
  backToCatalogue: ['Voltar ao catálogo', 'Back to the catalogue'],
  productUnavailable: [
    'Este produto não existe ou não está à venda.',
    'This product does not exist or is not on sale.',
  ],
  sizesAndPrices: ['Tamanhos e preços', 'Sizes and prices'],
  size: ['Tamanho', 'Size'],
  price: ['Preço', 'Price'],
  availability: ['Disponibilidade', 'Availability'],
  noSizeAvailable: [
    'Esta pizza não tem nenhum tamanho disponível.',
    'This pizza has no available size.',
  ],
  defaultComponents: ['Ingredientes base', 'Default ingredients'],
  // WEB03 (BR 4): public privacy notice (content owned by GDP01 / GDP02).
  privacyNotice: ['Aviso de privacidade', 'Privacy notice'],
  privacyIntro: [
    'Este aviso explica que dados pessoais a LaPrizza trata, para quê e que direitos tem.',
    'This notice explains which personal data LaPrizza processes, why, and which rights you have.',
  ],
  privacyControllerTitle: ['Responsável pelo tratamento', 'Data controller'],
  privacyController: [
    'A LaPrizza é a entidade responsável pelo tratamento dos dados pessoais recolhidos através deste site.',
    'LaPrizza is the entity responsible for processing the personal data collected through this website.',
  ],
  privacyDataTitle: ['Dados tratados', 'Data we process'],
  privacyDataAccount: [
    'Conta de utilizador: nome, endereço de e-mail, perfis atribuídos e o método de autenticação (palavra-passe protegida ou conta Google).',
    'User account: name, e-mail address, assigned roles and the sign-in method (protected password or Google account).',
  ],
  privacyDataCustomer: [
    'Clientes: contactos, moradas e restrições alimentares, quando indicados.',
    'Customers: contact details, addresses and dietary restrictions, when provided.',
  ],
  privacyDataAccess: [
    'Registos de acesso: tentativas de acesso negadas, sem palavras-passe nem segredos de sessão.',
    'Access records: denied access attempts, without passwords or session secrets.',
  ],
  privacyPurposeTitle: ['Finalidades', 'Purposes'],
  privacyPurpose: [
    'Os dados são usados para autenticar utilizadores, gerir clientes e o funcionamento do restaurante, e proteger o sistema. Comunicações opcionais só são enviadas com o seu consentimento.',
    'The data is used to authenticate users, manage customers and the restaurant operation, and protect the system. Optional communications are only sent with your consent.',
  ],
  privacyRetentionTitle: ['Conservação', 'Retention'],
  privacyRetention: [
    'Os dados são conservados apenas durante o tempo necessário para estas finalidades ou para cumprir obrigações legais.',
    'Data is kept only for as long as needed for these purposes or to meet legal obligations.',
  ],
  privacyRightsTitle: ['Os seus direitos', 'Your rights'],
  privacyRights: [
    'Pode pedir o acesso, a retificação, o apagamento ou a portabilidade dos seus dados, opor-se ou limitar o seu tratamento e retirar consentimentos a qualquer momento. Pode também apresentar reclamação à CNPD.',
    'You may request access to, rectification, erasure or portability of your data, object to or restrict its processing, and withdraw consent at any time. You may also lodge a complaint with the Portuguese data protection authority (CNPD).',
  ],
  // WEB06 - kitchen configuration page and validation issue codes.
  ...kitchenConfigurationMessages,

    pendingOutcomeNotice: [
    'O resultado de uma operação anterior ainda não foi confirmado. Atualize os dados e verifique se foi aplicada antes de a repetir.',
    'The result of a previous operation has not been confirmed. Refresh the data and check whether it was applied before trying again.',
  ],
  pendingOutcomeConfirm: ['Verifiquei o resultado', 'I checked the result'],

    pendingOutcomeApplied: [
    'A API confirma que a operação foi aplicada.',
    'The API confirms that the operation was applied.',
  ],
  pendingOutcomeNotApplied: [
    'A API mostra que a operação não foi aplicada. Os valores foram repostos; reveja-os e envie de novo se quiser.',
    'The API shows that the operation was not applied. The values were restored; review them and send again if you want.',
  ],
  pendingOutcomeUnconfirmed: [
    'Não foi possível confirmar o resultado com os dados atuais. A operação continua bloqueada; consulte o histórico e verifique de novo.',
    'The result could not be confirmed with the current data. The operation stays blocked; check the history and verify again.',
  ],
  pendingOutcomeReviewed: [
    'Dados atualizados a partir da API. Confirme na lista se a operação foi aplicada antes de a repetir; os valores foram repostos.',
    'Data refreshed from the API. Check in the list whether the operation was applied before repeating it; the values were restored.',
  ],
  
  conflictingFields: [
    'Campos alterados por si e por outro gestor',
    'Fields changed by you and by another manager',
  ],
  keepMyValue: ['Manter o meu valor', 'Keep my value'],
  useCurrentValue: ['Usar o valor atual', 'Use the current value'],
  resolveConflictsFirst: [
    'Escolha um valor para cada campo em conflito.',
    'Choose a value for each conflicting field.',
  ],
    predefinedPizzaInactive: [
    'Pizza inativa: não aparece no catálogo.',
    'Inactive pizza: not shown in the catalogue.',
  ],
  predefinedPizzaNotSellable: [
    'O produto não está marcado como vendável.',
    'The product is not marked as sellable.',
  ],
    predefinedPizzaNotOffered: [
    'Pizza ativa e vendável, mas sem oferta no catálogo.',
    'Active and sellable pizza, but not offered in the catalogue.',
  ],
  predefinedPizzaProductMissing: [
    'O produto desta pizza já não existe.',
    "This pizza's product no longer exists.",
  ],
};

/** True when the key has its own copy (used to fall back to server text). */
export function hasMessage(key) {
  return Object.hasOwn(messages, key);
}

export function translate(locale, key, values = {}) {
  const pair = Object.hasOwn(messages, key)
    ? messages[key]
    : messages.unknownMessage;
  const template = (locale === 'en-GB' ? pair[1] : pair[0]) ?? pair[0];
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    String(values[name] ?? ''),
  );
}
