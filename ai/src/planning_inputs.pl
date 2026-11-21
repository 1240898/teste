:- module(planning_inputs, [load_inputs/2, load_inputs/3]).
:- use_module(input_http).
:- use_module(input_validation).
:- use_module(input_mapper).
:- use_module(library(apply)).

%! load_inputs(+Execution, -Outcome) is det.
% Execution contains selectors and an input-attempt number, never business data.
load_inputs(Execution,Outcome) :-
    catch((input_service_config(Config),load_inputs(Execution,Config,Outcome)),
          Error, input_failure(Execution,Error,Outcome)),!.

%! load_inputs(+Execution, +ServiceConfig, -Outcome) is det.
% The explicit configuration variant is useful for embedding and HTTP tests.
load_inputs(Execution,Config,Outcome) :-
    catch(( validate_execution(Execution,Selection,Attempt),
            path_id("/internal/planning/input-runs/",Selection.executionId,RunPath),
            string_concat(RunPath,"/inputs",InputsPath),
            input_http(Config,read,get,InputsPath,none,Status,Reply),
            resolve_snapshot(Status,Reply,Selection,Attempt,Config,InputsPath,Bound),
            required(Bound,snapshot,Snapshot),required(Snapshot,snapshotId,SnapshotId),
            required(Snapshot,schemaVersion,Schema),
            require(Schema==1,"UNSUPPORTED_SCHEMA_VERSION","schemaVersion",Schema,"Unsupported retained-input schema."),
            required(Snapshot,document,Document),map_document(Document,Selection,SnapshotId,Input),
            Outcome=ok(Input) ),
          Error, input_failure(Execution,Error,Outcome)),!.

validate_execution(Execution,Selection,Attempt) :-
    require(ground(Execution),"NON_GROUND_INPUT","execution",none,"Execution selectors must be ground."),
    require(is_dict(Execution),"INVALID_INPUT","execution",none,"Expected execution selectors."),
    required(Execution,executionId,Id),identifier(Id,"executionId"),
    required(Execution,scenarioId,Scenario),identifier(Scenario,"scenarioId"),
    required(Execution,mode,Mode),require(memberchk(Mode,["current","historicalReplay"]),
      "INVALID_MODE","mode",Mode,"Unknown execution mode."),
    required(Execution,attemptNo,Attempt),positive_units(Attempt,"attemptNo"),
    del_dict(attemptNo,Execution,_,Selection).

resolve_snapshot(200,Reply,Selection,_,_,_,Reply) :- !,
    check_selection(Reply,Selection).
resolve_snapshot(409,Reply,Selection,Attempt,Config,InputsPath,Bound) :-
    get_dict(error,Reply,E),get_dict(code,E,"INPUTS_NOT_SEALED"),Selection.mode=="current",!,
    check_selection(Reply,Selection),required(Reply,execution,Current),required(Current,attemptNo,CurrentAttempt),
    require(CurrentAttempt==Attempt,"STALE_ATTEMPT","attemptNo",Attempt,"The input attempt is no longer current."),
    setup_call_cleanup(open_view(Config,Selection,View),
                       capture(Config,Selection,View,Document),close_view(Config,View)),
    % Validate before storing; map again from the winner returned by the records API.
    map_document(Document,Selection,"unsealed",_),
    input_http(Config,records,put,InputsPath,json{attemptNo:Attempt,document:Document},Status,Bound),
    success(Status,Bound),check_selection(Bound,Selection).
resolve_snapshot(Status,Reply,_,_,_,_,_) :- source_error(Status,Reply).

check_selection(Reply,Selection) :-
    required(Reply,execution,Execution),required(Execution,selection,Stored),
    require(same_json(Selection,Stored),"EXECUTION_SELECTION_CONFLICT","selection",Selection.executionId,
            "Execution selection differs from the registered input run.").
open_view(Config,Selection,View) :-
    input_http(Config,read,post,"/internal/planning/read-views",Selection,Status,View),success(Status,View),
    required(View,viewId,Id),identifier(Id,"viewId"),required(View,revision,Revision),identifier(Revision,"revision").
close_view(Config,View) :-
    path_id("/internal/planning/read-views/",View.viewId,Path),
    catch(input_http(Config,read,delete,Path,none,_,_),_,true).

capture(Config,Selection,View,Document) :-
    input_list(View,demandLines,AllLines),selected_lines(Selection.calculation,AllLines,Lines),
    findall(Id,(member(L,Lines),optional(L,productId,Id),Id\==none,identifier(Id,"demandLines.productId")),Root0),sort(Root0,RootIds),
    fetch(Config,View,"products",RootIds,[],Roots),check_ids(RootIds,Roots,productId,"products"),
    include(is_pizza_line,Lines,PizzaLines),
    findall(Id,(member(L,PizzaLines),required(L,sizeId,Id),identifier(Id,"demandLines.sizeId")),Size0),sort(Size0,SizeIds),
    fetch(Config,View,"sizes",[],SizeIds,Sizes),check_ids(SizeIds,Sizes,sizeId,"sizes"),
    findall(Id,(member(L,PizzaLines),\+get_dict(selectedComponents,L,_),\+get_dict(selectedComponentIds,L,_),required(L,productId,Id)),Default0),sort(Default0,DefaultIds),
    fetch(Config,View,"pizza-configurations",DefaultIds,[],Pizzas),check_ids(DefaultIds,Pizzas,productId,"pizzaConfigurations"),
    findall(Id,(member(L,PizzaLines),component_selection(L,Pizzas,_,Ids),member(Id,Ids)),Component0),sort(Component0,ComponentIds),
    collect_products(Config,View,ComponentIds,RootIds,Roots,Products,[],Recipes),
    fetch(Config,View,"component-configurations",ComponentIds,SizeIds,Configs),
    planning_items(View,Products,Items),
    findall(Id,member(item(Id,_,true,_,_,_),Items),Tracked),
    fetch(Config,View,"stock",Tracked,[],Stock),
    (Selection.calculation=="REQUIREMENTS_PLANNING" -> fetch(Config,View,"incoming-deliveries",Tracked,[],Receipts) ; Receipts=[]),
    supplier_inputs(Config,Selection,Items,Supplier),
    optional(View,forecast,Forecast),json_optional(Forecast,ForecastJson),
    ViewMetadata=json{viewId:View.viewId,revision:View.revision,retrievedAt:View.retrievedAt,
                      cataloguePolicy:View.cataloguePolicy,provenance:View.provenance},
    Document=json{schemaVersion:1,selection:Selection,view:ViewMetadata,demandLines:Lines,forecast:ForecastJson,
                  products:Products,sizes:Sizes,pizzaConfigurations:Pizzas,componentConfigurations:Configs,
                  recipes:Recipes,openingStock:Stock,pendingDeliveries:Receipts,supplierScenario:Supplier}.

is_pizza_line(L) :- get_dict(type,L,"pizza").
json_optional(none,null) :- !.
json_optional(Value,Value).
fetch(Config,View,Group,Ids,Sizes,Items) :-
    path_id("/internal/planning/read-views/",View.viewId,ViewPath),
    atomics_to_string([ViewPath,"/",Group],Path),
    input_http(Config,read,post,Path,json{productIds:Ids,sizeIds:Sizes},Status,Reply),success(Status,Reply),
    required(Reply,viewId,ReplyId),required(Reply,revision,Revision),
    require((ReplyId==View.viewId,Revision==View.revision),"MIXED_INPUT_VERSIONS","view",ReplyId,
            "Source records do not belong to the selected coherent view."),input_list(Reply,items,Items).
check_ids(Expected,Records,Key,Field) :-
    findall(Id,(member(R,Records),required(R,Key,Id)),Ids),unique(Ids,Field,none),sort(Ids,Actual),sort(Expected,Wanted),
    (Actual==Wanted -> true
    ; subtract(Wanted,Actual,Missing),subtract(Actual,Wanted,Extra),append(Missing,Extra,[Affected|_]),
      input_error("UNKNOWN_REFERENCE",Field,Affected,"The source must return every requested identity exactly once.")).

% Visit each product once. Shared ingredients and cycles cannot cause endless
% source reads; AI01 remains responsible for recipe cycle diagnostics.
collect_products(Config,View,Queue,Seen,Before,Products,Recipes0,Recipes) :-
    subtract(Queue,Seen,Missing0),sort(Missing0,Missing),
    ( Missing==[] -> New=[],NextProducts=Before,NextSeen=Seen
    ; fetch(Config,View,"products",Missing,[],New),check_ids(Missing,New,productId,"products"),
      append(Before,New,NextProducts),append(Seen,Missing,NextSeen) ),
    include(produced_product(View),New,Produced),findall(Id,(member(P,Produced),required(P,productId,Id)),ProducedIds),
    % Include produced roots and skip recipes already read on an earlier visit.
    findall(Id,(member(P,NextProducts),produced_product(View,P),required(P,productId,Id),
                \+ (member(Known,Recipes0),get_dict(productId,Known,Id))),Additional),
    append(ProducedIds,Additional,RecipeIds0),sort(RecipeIds0,RecipeIds),
    (RecipeIds==[] -> Raw=[] ; fetch(Config,View,"recipes",RecipeIds,[],Raw),check_ids(RecipeIds,Raw,productId,"recipes")),
    append(Recipes0,Raw,NextRecipes),
    findall(Id,(member(R,Raw),input_list(R,ingredients,Ingredients),member(I,Ingredients),required(I,productId,Id)),Children0),sort(Children0,Children),
    (Children==[] -> Products=NextProducts,Recipes=NextRecipes
    ; collect_products(Config,View,Children,NextSeen,NextProducts,Products,NextRecipes,Recipes)).
produced_product(View,P) :-
    (View.cataloguePolicy=="explicit-fixture";get_dict(planningOrigin,P,"fixture")),
    get_dict(kind,P,"aggregate"),get_dict(acquisitionType,P,Acq),memberchk(Acq,["produced","PRODUCED"]).

supplier_inputs(_,Selection,_,null) :- Selection.calculation=="BOM",!.
supplier_inputs(Config,Selection,Items,Supplier) :-
    required(Selection,supplierScenario,Wanted),supplier_product_ids(Items,Ids),
    Payload=json{id:Wanted.id,version:Wanted.version,productIds:Ids},
    (get_dict(type,Wanted,Type) -> Request=Payload.put(type,Type) ; Request=Payload),
    input_http(Config,read,post,"/internal/planning/supplier-offers",
               Request,Status,Supplier),success(Status,Supplier).
success(Status,_) :- between(200,299,Status),!.
success(Status,Reply) :- source_error(Status,Reply).
source_error(Status,Reply) :-
    (get_dict(error,Reply,E),get_dict(code,E,Code),get_dict(message,E,Message) ->
       optional(E,field,Field),optional(E,reference,Reference),
       throw(error(planning_input(diagnostic{code:Code,message:Message,field:Field,reference:Reference,status:Status}),_))
    ; input_error("INPUT_SOURCE_UNAVAILABLE","http",Status,"Unexpected planning source response.") ).
contextual_error(Execution,Diagnostic,error(Context)) :-
    foldl(add_context(Execution),[scenarioId,executionId],Diagnostic,Context).
input_failure(Execution,error(planning_input(Diagnostic),_),Outcome) :- !,
    contextual_error(Execution,Diagnostic,Outcome).
% Malformed nested JSON must not escape as a raw Prolog exception or disclose
% transport configuration. Expected business errors keep their precise codes.
input_failure(Execution,_,Outcome) :-
    contextual_error(Execution,diagnostic{code:"INVALID_SOURCE_RESPONSE",field:"response",reference:none,
      message:"The selected input response has an invalid structure."},Outcome).
add_context(Execution,Key,Before,After) :-
    (is_dict(Execution),get_dict(Key,Execution,Value),string(Value) -> After=Before.put(Key,Value) ; After=Before).
