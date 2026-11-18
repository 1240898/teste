// WEB06 - Kitchen configuration page (PT / EN). Validation issues are
// translated from their stable code (and variant) plus the values sent by the
// back end, so a language switch re-translates them without a request (BR 21).
export const kitchenConfigurationMessages = {
  kitchenConfigurationsIntro: [
    'Gira as configurações JSON da cozinha e escolha a que o visualizador 3D usa.',
    'Manage the kitchen JSON configurations and choose the one used by the 3D viewer.',
  ],
  newKitchenConfiguration: ['Nova configuração', 'New configuration'],
  kitchenConfigurationName: ['Nome', 'Name'],
  kitchenConfigurationId: ['Identificador', 'Identifier'],
  kitchenConfigurationStatus: ['Estado', 'Status'],
  kitchenConfigurationVersion: ['Versão', 'Version'],
  kitchenConfigurationElements: ['Elementos', 'Elements'],
  kitchenConfigurationUpdatedAt: ['Atualizada em', 'Updated at'],
  kitchenConfigurationActions: ['Ações', 'Actions'],
  kitchenStatusACTIVE: ['Ativa', 'Active'],
  kitchenStatusINACTIVE: ['Inativa', 'Inactive'],
  kitchenActivate: ['Ativar', 'Activate'],
  kitchenDelete: ['Eliminar', 'Delete'],
  kitchenConsult: ['Consultar', 'Consult'],
  kitchenEdit: ['Editar', 'Edit'],
  kitchenBackToList: ['Voltar às configurações', 'Back to the configurations'],
  kitchenNoConfigurations: [
    'Ainda não existem configurações da cozinha.',
    'There are no kitchen configurations yet.',
  ],
  kitchenNoConfigurationsHint: [
    'Crie ou importe uma configuração e ative-a para o visualizador.',
    'Create or import a configuration and activate it for the viewer.',
  ],
  kitchenNoActiveConfiguration: [
    'Nenhuma configuração está ativa: o visualizador 3D não mostra nenhuma cozinha até ativar uma.',
    'No configuration is active: the 3D viewer shows no kitchen until you activate one.',
  ],
  kitchenActiveConfiguration: [
    'Configuração ativa: {name} ({id}).',
    'Active configuration: {name} ({id}).',
  ],
  kitchenActivatedNotice: [
    '{name} ({id}) é agora a configuração ativa.',
    '{name} ({id}) is now the active configuration.',
  ],
  kitchenOpenViewer: [
    'Abrir / recarregar o visualizador da cozinha',
    'Open / reload the kitchen viewer',
  ],
  kitchenListLoadFailed: [
    'Não foi possível carregar as configurações da cozinha.',
    'The kitchen configurations could not be loaded.',
  ],
  kitchenActivateTitle: ['Ativar configuração', 'Activate configuration'],
  kitchenActivateConsequence: [
    '“{name}” ({id}) passará a ser usada pelo visualizador 3D.',
    '“{name}” ({id}) will be used by the 3D viewer.',
  ],
  kitchenActivateReplaceConsequence: [
    '“{name}” ({id}) passará a ser usada pelo visualizador 3D e “{currentName}” ficará inativa.',
    '“{name}” ({id}) will be used by the 3D viewer and “{currentName}” will become inactive.',
  ],
  kitchenDeleteTitle: ['Eliminar configuração', 'Delete configuration'],
  kitchenDeleteConsequence: [
    '“{name}” ({id}) será eliminada definitivamente.',
    '“{name}” ({id}) will be permanently deleted.',
  ],
  kitchenDeleted: ['Configuração eliminada.', 'Configuration deleted.'],
  kitchenDeleteDisabledHint: [
    'Ative outra configuração antes de eliminar esta.',
    'Activate another configuration before deleting this one.',
  ],
  kitchenCreated: [
    'Configuração {id} criada (inativa).',
    'Configuration {id} created (inactive).',
  ],
  kitchenDownloadJson: ['Descarregar JSON', 'Download JSON'],
  kitchenActivatedAt: ['Ativada em', 'Activated at'],
  kitchenActiveNotDeletable: [
    'A configuração ativa não pode ser eliminada. Ative outra primeiro.',
    'The active configuration cannot be deleted. Activate another one first.',
  ],
  kitchenActivationInvalid: [
    'A configuração não foi ativada: o conteúdo ou os ficheiros dos recursos já não são válidos. A configuração ativa não mudou.',
    'The configuration was not activated: its content or asset files are no longer valid. The active configuration did not change.',
  ],
  kitchenActivationRace: [
    'Outra ativação estava em curso. Recarregue e tente novamente.',
    'Another activation was in progress. Reload and try again.',
  ],
  kitchenConfigurationGone: [
    'Esta configuração já não existe.',
    'This configuration no longer exists.',
  ],
  kitchenEditorCreateTitle: [
    'Nova configuração da cozinha',
    'New kitchen configuration',
  ],
  kitchenEditorEditTitle: ['Editar configuração', 'Edit configuration'],
  kitchenJsonContent: ['Conteúdo JSON', 'JSON content'],
  kitchenJsonHint: [
    'Formato schemaVersion 1 (metros e graus). Modelos e texturas são referidos pelo identificador do catálogo (AST-…).',
    'Format schemaVersion 1 (metres and degrees). Models and textures are referenced by their catalogue id (AST-…).',
  ],
  kitchenImportFile: ['Importar ficheiro .json', 'Import .json file'],
  kitchenValidate: ['Validar', 'Validate'],
  kitchenSave: ['Guardar', 'Save'],
  kitchenImportExtension: [
    'Só podem ser importados ficheiros .json.',
    'Only .json files can be imported.',
  ],
  kitchenImportSize: [
    'O ficheiro excede 100 KB.',
    'The file is larger than 100 KB.',
  ],
  kitchenImportRead: [
    'Não foi possível ler o ficheiro.',
    'The file could not be read.',
  ],
  kitchenImported: [
    '“{file}” foi carregado no editor. Ainda não foi guardado.',
    '“{file}” was loaded into the editor. It has not been saved yet.',
  ],
  kitchenSyntaxError: [
    'JSON inválido na linha {line}, coluna {column}. Nada foi enviado.',
    'Invalid JSON at line {line}, column {column}. Nothing was sent.',
  ],
  kitchenSyntaxErrorNoPosition: [
    'JSON inválido. Nada foi enviado.',
    'Invalid JSON. Nothing was sent.',
  ],
  kitchenEmptyJson: [
    'Introduza ou importe o conteúdo JSON.',
    'Type or import the JSON content.',
  ],
  kitchenNotObject: [
    'O conteúdo deve ser um objeto JSON.',
    'The content must be a JSON object.',
  ],
  kitchenContentInvalid: [
    'O conteúdo tem {count} problema(s). A configuração guardada não foi alterada.',
    'The content has {count} issue(s). The stored configuration was not changed.',
  ],
  kitchenValidationOk: ['O conteúdo é válido.', 'The content is valid.'],
  kitchenValidationIssues: [
    'O conteúdo tem {count} problema(s).',
    'The content has {count} issue(s).',
  ],
  kitchenSaved: [
    'Configuração guardada (versão {version}).',
    'Configuration saved (version {version}).',
  ],
  kitchenSavedActive: [
    'Configuração guardada (versão {version}). O visualizador mostra a nova cozinha da próxima vez que carregar.',
    'Configuration saved (version {version}). The viewer shows the new layout the next time it loads.',
  ],
  kitchenNameTaken: [
    'Já existe uma configuração com este nome.',
    'A configuration with this name already exists.',
  ],
  kitchenNameLength: [
    'O nome deve ter entre 3 e 80 caracteres.',
    'The name must have between 3 and 80 characters.',
  ],
  kitchenTooLarge: [
    'O conteúdo excede o limite de 100 KB.',
    'The content exceeds the 100 KB limit.',
  ],
  kitchenIssuesTitle: ['Problemas encontrados', 'Issues found'],
  kitchenIssueRoot: ['(conteúdo)', '(content)'],
  // Concurrent change (client clarification 15, D16).
  kitchenConflictTitle: [
    'Alterada por outro utilizador',
    'Changed by another user',
  ],
  kitchenConflictNotice: [
    'Esta configuração foi alterada por outro utilizador. Recarregue-a antes de guardar. As suas alterações foram mantidas.',
    'This configuration was changed by another user. Reload it before saving. Your changes are kept.',
  ],
  kitchenReloadLatest: [
    'Recarregar a versão mais recente',
    'Reload latest version',
  ],
  kitchenLatestVersion: [
    'Versão atual: {version} ({updatedAt}).',
    'Current version: {version} ({updatedAt}).',
  ],
  kitchenTheirChanges: [
    'Alterações do outro utilizador (mantidas)',
    'Changes by the other user (kept)',
  ],
  kitchenMyChanges: [
    'As suas alterações, reaplicadas na versão {version}',
    'Your changes, re-applied on version {version}',
  ],
  kitchenConflicts: ['Conflitos', 'Conflicts'],
  kitchenNoChanges: ['Nenhuma.', 'None.'],
  kitchenConflictValues: [
    'original: {base} · sua: {mine} · do outro: {theirs}',
    'original: {base} · yours: {mine} · theirs: {theirs}',
  ],
  kitchenRemovedValue: ['(removido)', '(removed)'],
  kitchenKeepMine: ['Manter a minha', 'Keep mine'],
  kitchenKeepTheirs: ['Manter a do outro', 'Keep theirs'],
  kitchenContinueRebased: [
    'Continuar com a versão reaplicada',
    'Continue with the rebased version',
  ],
  kitchenDiscardDraft: ['Descartar as minhas alterações', 'Discard my draft'],
  kitchenReviewAcknowledged: [
    'Revi as alterações do outro utilizador',
    "I reviewed the other user's changes",
  ],
  kitchenRebaseImpossible: [
    'Corrija a sintaxe JSON do seu rascunho para o aplicar na versão mais recente, ou descarte-o.',
    'Fix the JSON syntax of your draft to apply it on the latest version, or discard it.',
  ],
  kitchenResolveConflictsFirst: [
    'Resolva todos os conflitos para continuar.',
    'Resolve every conflict to continue.',
  ],
  kitchenReviewBeforeSave: [
    'Confirme que reviu as alterações do outro utilizador para poder guardar.',
    "Confirm that you reviewed the other user's changes to save.",
  ],
  // Validation issue codes (usWEB06 2.4.1).
  'kitchenIssue:REQUIRED': [
    'Propriedade obrigatória em falta.',
    'Required property is missing.',
  ],
  'kitchenIssue:INVALID_TYPE': [
    'Tipo inválido (esperado: {expected}).',
    'Invalid type (expected: {expected}).',
  ],
  'kitchenIssue:UNKNOWN_PROPERTY': [
    'Propriedade desconhecida “{property}”.',
    'Unknown property “{property}”.',
  ],
  'kitchenIssue:UNSUPPORTED_SCHEMA_VERSION': [
    'Valor não suportado (esperado: {expected}).',
    'Unsupported value (expected: {expected}).',
  ],
  'kitchenIssue:INVALID_DIMENSION': [
    'Deve estar entre {min} e {max} metros.',
    'Must be between {min} and {max} metres.',
  ],
  'kitchenIssue:INVALID_SCALE': [
    'Deve estar entre {min} e {max}.',
    'Must be between {min} and {max}.',
  ],
  'kitchenIssue:INVALID_ROTATION': [
    'Deve estar entre {min} e {max} graus.',
    'Must be between {min} and {max} degrees.',
  ],
  'kitchenIssue:OUT_OF_BOUNDS': [
    'Fora da cozinha: deve estar entre {min} e {max} metros.',
    'Outside the kitchen: must be between {min} and {max} metres.',
  ],
  'kitchenIssue:INVALID_ELEMENT_ID': [
    'Identificador inválido: use 1 a 64 letras, dígitos, “_” ou “-”.',
    'Invalid id: use 1 to 64 letters, digits, “_” or “-”.',
  ],
  'kitchenIssue:DUPLICATE_ELEMENT_ID': [
    'O identificador “{id}” já é usado em {other}.',
    'The id “{id}” is already used by {other}.',
  ],
  'kitchenIssue:INVALID_ENUM': [
    'Valor “{value}” inválido. Valores aceites: {allowed}.',
    'Invalid value “{value}”. Accepted values: {allowed}.',
  ],
  'kitchenIssue:MISSING_CATEGORY:noEquipment': [
    'A cozinha precisa de pelo menos um elemento EQUIPMENT.',
    'The kitchen needs at least one EQUIPMENT element.',
  ],
  'kitchenIssue:MISSING_CATEGORY:tooMany': [
    'Uma cozinha tem no máximo {max} elementos.',
    'A kitchen has at most {max} elements.',
  ],
  'kitchenIssue:LINE_COMPOSITION:exactlyOne': [
    'A linha de montagem precisa de exatamente um {type} (encontrados: {found}).',
    'The assembly line needs exactly one {type} (found: {found}).',
  ],
  'kitchenIssue:LINE_COMPOSITION:arms': [
    'A linha de montagem precisa de {min} a {max} braços robóticos (encontrados: {found}).',
    'The assembly line needs {min} to {max} robotic arms (found: {found}).',
  ],
  'kitchenIssue:LINE_NOT_AT_WALL': [
    'Está a {distance} m da parede {wall} (máximo {max} m).',
    'It is {distance} m from the {wall} wall (at most {max} m).',
  ],
  'kitchenIssue:LINE_ORDER:platformAfterOven': [
    'A plataforma de receção deve ficar na ponta esquerda e o forno na ponta direita da linha.',
    'The receiving platform must be at the left end and the oven at the right end of the line.',
  ],
  'kitchenIssue:LINE_ORDER:armOutside': [
    'Os braços robóticos devem ficar entre a plataforma de receção e o forno.',
    'Robotic arms must be between the receiving platform and the oven.',
  ],
  'kitchenIssue:LINE_ORDER:beltOutside': [
    'O tapete rolante deve ficar entre a plataforma de receção e o forno.',
    'The conveyor belt must be between the receiving platform and the oven.',
  ],
  'kitchenIssue:LINE_ORDER:dispenserFar': [
    'O dispensador deve ficar a menos de {max} m da plataforma (está a {distance} m).',
    'The dispenser must be within {max} m of the platform (it is {distance} m away).',
  ],
  'kitchenIssue:LINE_ORDER:dispenserLow': [
    'O dispensador deve ficar acima da plataforma de receção.',
    'The dispenser must be above the receiving platform.',
  ],
  'kitchenIssue:LINE_ALIGNMENT:tilted': [
    'Só é permitida rotação em torno de Y.',
    'Only a rotation around Y is allowed.',
  ],
  'kitchenIssue:LINE_ALIGNMENT:notRightAngle': [
    'A rotação em Y deve ser múltipla de 90°.',
    'The Y rotation must be a multiple of 90°.',
  ],
  'kitchenIssue:LINE_ALIGNMENT:beltAcross': [
    'O tapete rolante (eixo +X do modelo) deve ficar ao longo da parede.',
    'The conveyor belt (model +X axis) must run along the wall.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:startsAfter': [
    'O tapete rolante começa {distance} m depois da plataforma de receção.',
    'The conveyor belt starts {distance} m after the receiving platform.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:startsBefore': [
    'O tapete rolante começa {distance} m antes da plataforma de receção.',
    'The conveyor belt starts {distance} m before the receiving platform.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:endsBefore': [
    'O tapete rolante termina {distance} m antes do forno.',
    'The conveyor belt ends {distance} m before the oven.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:endsAfter': [
    'O tapete rolante termina {distance} m depois do forno.',
    'The conveyor belt ends {distance} m beyond the oven.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:depthPlatform': [
    'O tapete rolante não chega à plataforma de receção em profundidade.',
    'The conveyor belt does not reach the receiving platform in depth.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:depthOven': [
    'O tapete rolante não chega ao forno em profundidade.',
    'The conveyor belt does not reach the oven in depth.',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:levelPlatform': [
    'O topo do tapete está a {distance} m do topo da plataforma (máximo {max} m).',
    'The top of the belt is {distance} m from the top of the platform (at most {max} m).',
  ],
    'kitchenIssue:LINE_BELT_DISCONNECTED:belowOven': [
    'O topo do tapete rolante está {distance} m abaixo da entrada do forno (no máximo {max} m).',
    'The top of the conveyor belt is {distance} m below the oven entrance (at most {max} m).',
  ],
  'kitchenIssue:LINE_BELT_DISCONNECTED:levelOven': [
    'O topo do tapete rolante deve ficar abaixo do topo do forno.',
    'The top of the conveyor belt must be below the top of the oven.',
  ],
  'kitchenIssue:UNKNOWN_ASSET': [
    'O recurso “{assetId}” não existe no catálogo.',
    'Asset “{assetId}” does not exist in the catalogue.',
  ],
  'kitchenIssue:ASSET_FILE_MISSING': [
    'O ficheiro do recurso “{assetId}” não está disponível.',
    'The file of asset “{assetId}” is not available.',
  ],
  'kitchenIssue:ASSET_KIND_MISMATCH': [
    '“{assetId}” não é um recurso do tipo {expected}.',
    '“{assetId}” is not a {expected} asset.',
  ],
  'kitchenIssue:INVALID_MATERIAL:color': [
    'A cor deve ter o formato #RRGGBB.',
    'The colour must use the #RRGGBB format.',
  ],
  'kitchenIssue:INVALID_MATERIAL:range': [
    'Deve estar entre {min} e {max}.',
    'Must be between {min} and {max}.',
  ],
  'kitchenIssue:INCOMPLETE_TEXTURE_SET:noColor': [
    'Um conjunto de texturas precisa de um mapa de cor (colorMapAssetId).',
    'A texture set needs a colour map (colorMapAssetId).',
  ],
  'kitchenIssue:INCOMPLETE_TEXTURE_SET:colorOnly': [
    'O mapa de cor precisa de um mapa de rugosidade, normal ou relevo.',
    'The colour map needs a roughness, normal or bump map.',
  ],
  'kitchenIssue:MATERIAL_REQUIRED': [
    'É obrigatório um material com um conjunto de texturas.',
    'A material with a texture set is required.',
  ],
  'kitchenIssue:MODEL_TEXTURES_MISSING': [
    'O modelo “{assetId}” não tem texturas completas: defina um material com um conjunto de texturas.',
    'Model “{assetId}” has no complete texture set: define a material with a texture set.',
  ],
};