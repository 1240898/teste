:- module(input_mapper, [map_document/4, component_selection/4, selected_lines/3,
    supplier_product_ids/2, price_cents/2, planning_items/3]).
:- use_module(library(crypto)).
:- use_module(library(pairs)).
:- use_module(library(date)).
:- use_module(input_validation).

% AI06 resolves source records and builds terms; it never nets stock or chooses
% suppliers. Recipes remain explicit for AI01 to expand and check for cycles.
map_document(Document, Execution, SnapshotId, Input) :-
    required(Document,schemaVersion,Schema),
    require(Schema==1,"UNSUPPORTED_SCHEMA_VERSION","schemaVersion",Schema,"Unsupported retained-input document schema."),
    required(Document,selection,Original),
    required(Execution,calculation,Calculation),
    require(Original.calculation==Calculation,"REPLAY_SELECTION_CONFLICT","calculation",none,
            "Replay must use the original calculation type."),
    input_list(Document,products,Products), input_list(Document,sizes,Sizes),
    input_list(Document,recipes,Recipes0), input_list(Document,openingStock,Stock0),
    input_list(Document,componentConfigurations,Configs),
    input_list(Document,pizzaConfigurations,Pizzas), input_list(Document,demandLines,Lines0),
    check_unique_records(Products,productId,"products"),
    check_unique_records(Sizes,sizeId,"sizes"), check_unique_records(Stock0,productId,"openingStock"),
    check_unique_records(Recipes0,productId,"recipes"), check_unique_records(Pizzas,productId,"pizzaConfigurations"),
    findall(P-S,(member(C,Configs),required(C,productId,P),required(C,sizeId,S)),ConfigPairs),
    unique(ConfigPairs,"componentConfigurations",none),
    required(Document,view,View),required(View,cataloguePolicy,Policy),
    require(memberchk(Policy,["explicit-fixture","pizza-components-terminal"]),
            "INVALID_CLASSIFICATION","cataloguePolicy",Policy,"Unknown catalogue mapping policy."),
    maplist(product_state,Products,ProductStates),maplist(size_state,Sizes,SizeStates),
    planning_items(View,Products,Items),
    maplist(map_recipe(Items),Recipes0,Recipes),
    maplist(map_stock(Items),Stock0,Stock),
    forall(member(item(Id,_,Tracked,_,_,_),Items),check_stock(Id,Tracked,Stock)),
    selected_lines(Calculation,Lines0,Lines),
    maplist(map_demand(Calculation,Products,Sizes,Pizzas,Configs),Lines,Mapped),
    findall(D,member(pizza(D,_),Mapped),Demands),findall(B,member(pizza(_,B),Mapped),Boms0),sort(Boms0,Boms),
    findall(D,member(sale(D),Mapped),Sales),
    forall(member(direct_sale(_,Id,_),Sales),check_sale_factor(Items,Id)),
    map_forecast(Calculation,Document,Original,Lines,Forecast,Reference),
    map_offers(Calculation,Document,Original,Items,Offers,SupplierMeta,OfferProvenance),
    map_receipts(Calculation,Document,Items,Receipts),
    validate_input_provenance(Original,View,OfferProvenance,Provenance),
    (member(P,Provenance),P.simulated==true -> Simulation=true ; Simulation=false),
    Meta0=meta{executionId:Execution.executionId,scenarioId:Execution.scenarioId,
               snapshotId:SnapshotId,schemaVersion:1,calculation:Calculation,
               mode:Execution.mode,simulation:Simulation,provenance:Provenance},
    ( SupplierMeta==none -> Meta1=Meta0 ; Meta1=Meta0.put(supplierScenario,SupplierMeta) ),
    ( Execution.mode=="historicalReplay" -> Meta=Meta1.put(replayedFrom,Execution.replayedFrom) ; Meta=Meta1 ),
    Input=planning_input{meta:Meta,eligibility:eligibility{products:ProductStates,sizes:SizeStates},
          pizza_demand:Demands,pizza_boms:Boms,items:Items,recipes:Recipes,opening_stock:Stock,
          direct_sale_demand:Sales,offers:Offers,forecast:Forecast,reference_date:Reference,pending_receipts:Receipts},
    require(ground(Input),"INVALID_INPUT","input",none,"The mapped knowledge base must be ground.").

check_unique_records(Records,Key,Field) :-
    findall(Id,(member(R,Records),required(R,Key,Id),identifier(Id,Field)),Ids),unique(Ids,Field,none).
record(Records,Key,Id,Field,Record) :-
    ( member(Record,Records),get_dict(Key,Record,Id) -> true
    ; input_error("UNKNOWN_REFERENCE",Field,Id,"Referenced source record was not returned.") ).
product_state(P,product_active(Id,Active)) :-
    required(P,productId,Id),required(P,isActive,Active),
    required(P,isPizza,Pizza),required(P,isSellable,Sellable),
    require((memberchk(Pizza,[true,false]),memberchk(Sellable,[true,false])),
            "INVALID_CLASSIFICATION","products",Id,"Pizza and sellable roles must be explicit booleans."),
    require(memberchk(Active,[true,false]),"INVALID_ELIGIBILITY","products.isActive",Id,"Eligibility must be a boolean."),
    require(Active==true,"INACTIVE_REFERENCE","products.isActive",Id,"An inactive product cannot enter a fresh capture.").
size_state(S,size_active(Id,Active)) :-
    required(S,sizeId,Id),required(S,isActive,Active),
    require(memberchk(Active,[true,false]),"INVALID_ELIGIBILITY","sizes.isActive",Id,"Eligibility must be a boolean."),
    require(Active==true,"INACTIVE_REFERENCE","sizes.isActive",Id,"The selected size is inactive.").
is_pizza(P) :- get_dict(isPizza,P,true).

planning_items(View,Products,Items) :-
    required(View,cataloguePolicy,Policy),exclude(is_pizza,Products,PlanningProducts),
    maplist(map_item(Policy),PlanningProducts,Items).

map_item(Policy,P,item(Id,Kind,Tracked,Acquisition,Unit,PerSale)) :-
    required(P,productId,Id),required(P,tracked,Tracked),
    require(memberchk(Tracked,[true,false]),"INVALID_TRACKING","products.tracked",Id,"Tracking must be explicit."),
    ( (Policy=="explicit-fixture" ; get_dict(planningOrigin,P,"fixture")) -> Explicit=true ; Explicit=false ),
    ( Explicit==true -> required(P,kind,KindText), enum_kind(KindText,Kind,Id) ; Kind=terminal ),
    optional(P,acquisitionType,AcqText),acquisition(AcqText,Acquisition,Id),
    ( Kind==aggregate -> require(memberchk(Acquisition,[produced,purchased]),"INVALID_CLASSIFICATION",
                         "products.acquisitionType",Id,"Aggregates require a production or purchase classification.") ; true ),
    optional(P,stockUnit,Unit),
    (Tracked==true ->
      require(Unit\==none,"MISSING_STOCK_UNIT","products.stockUnit",Id,"A tracked product needs its configured stock unit."),
      identifier(Unit,"products.stockUnit") ; true),
    optional(P,stockUnitsPerSale,PerSale),
    (PerSale==none -> true ; units(PerSale,"products.stockUnitsPerSale")).
enum_kind("terminal",terminal,_) :- !.
enum_kind("aggregate",aggregate,_) :- !.
enum_kind(_,_,Id) :- input_error("INVALID_CLASSIFICATION","products.kind",Id,"Item kind must be terminal or aggregate.").
acquisition("PRODUCED",produced,_) :- !.
acquisition("produced",produced,_) :- !.
acquisition("PURCHASED",purchased,_) :- !.
acquisition("purchased",purchased,_) :- !.
acquisition(none,none,_) :- !.
acquisition("none",none,_) :- !.
acquisition(_,_,Id) :- input_error("INVALID_CLASSIFICATION","products.acquisitionType",Id,"Unknown acquisition type.").

map_recipe(Items,R,recipe(Id,Yield,Ingredients)) :-
    required(R,productId,Id),required(R,yieldUnits,Yield),positive_units(Yield,"recipes.yieldUnits"),
    require(memberchk(item(Id,aggregate,true,produced,_,_),Items),"INVALID_RECIPE","recipes",Id,
            "Only explicitly produced tracked aggregates have planning recipes."),
    input_list(R,ingredients,Raw),require(Raw\==[],"INCOMPLETE_RECIPE","recipes",Id,"Recipe ingredients are missing."),
    check_unique_records(Raw,productId,"recipes.ingredients"),
    maplist(map_ingredient(Items),Raw,Ingredients).
map_ingredient(Items,R,ingredient(Id,Q)) :-
    required(R,productId,Id),required(R,unitsPerBatch,Q),positive_units(Q,"recipes.unitsPerBatch"),
    require(memberchk(item(Id,_,true,_,_,_),Items),"UNKNOWN_REFERENCE","recipes.ingredients",Id,
            "Every recipe ingredient must have a tracked planning item.").
map_stock(Items,R,stock(Id,Q)) :-
    required(R,productId,Id),required(R,availableUnits,Q),units(Q,"openingStock.availableUnits"),
    require(memberchk(item(Id,_,true,_,Unit,_),Items),"INCONSISTENT_STOCK","openingStock",Id,
            "Opening balances belong to selected tracked planning items."),
    optional(R,stockUnit,SourceUnit),
    require(SourceUnit\==none,"MISSING_STOCK_UNIT","openingStock.stockUnit",Id,
            "The stock source must identify the unit of its opening balance."),
    require(SourceUnit==Unit,"INCOMPATIBLE_UNITS","openingStock.stockUnit",Id,
            "Opening stock and catalogue units must match.").
check_stock(Id,true,Stock) :- !,
    require(memberchk(stock(Id,_),Stock),"MISSING_STOCK","openingStock",Id,"A tracked item's opening balance is missing.").
check_stock(_,false,_).
check_sale_factor(Items,Id) :-
    ( memberchk(item(Id,_,true,_,_,Factor),Items) ->
        require(Factor\==none,"MISSING_CONSUMPTION","products.stockUnitsPerSale",Id,"Direct-sale stock consumption is missing.")
    ; true ).

selected_lines("BOM",Lines,Selected) :- !,include(pizza_line,Lines,Selected).
selected_lines("REQUIREMENTS_PLANNING",Lines,Lines) :- !.
selected_lines(_,_,_) :- input_error("INVALID_CALCULATION","calculation",none,"Unknown calculation type.").
pizza_line(Line) :- required(Line,type,Type),
    require(memberchk(Type,["pizza","directSale"]),"INVALID_DEMAND","demandLines.type",Type,"Unknown demand type."),Type=="pizza".

map_demand(Calculation,Products,Sizes,Pizzas,Configs,Line,Mapped) :-
    required(Line,type,Type),required(Line,quantity,Q),units(Q,"demandLines.quantity"),
    demand_date(Calculation,Line,Date),
    (Type=="pizza" ->
        optional(Line,productId,PizzaId),required(Line,sizeId,Size),identifier(Size,"demandLines.sizeId"),
        record(Sizes,sizeId,Size,"demandLines.sizeId",_),
        (PizzaId==none -> true ; record(Products,productId,PizzaId,"demandLines.productId",P),
          require((get_dict(isPizza,P,true),get_dict(isSellable,P,true)),"INVALID_PIZZA","demandLines.productId",PizzaId,"The selected product is not a sellable pizza.")),
        component_selection(Line,Pizzas,RawComponents,_),
        maplist(map_component(Products,Configs,Size),RawComponents,Components0),sort(Components0,Components),
        bom_id(PizzaId,Size,Components,BomId),
        Mapped=pizza(pizza_demand(Date,BomId,Q),bom(BomId,PizzaId,Size,Components))
    ; Type=="directSale" ->
        required(Line,productId,Id),record(Products,productId,Id,"demandLines.productId",P),
        require((get_dict(isSellable,P,true),\+get_dict(isPizza,P,true)),"INVALID_DIRECT_SALE","demandLines.productId",Id,"Direct sale must refer to a non-pizza sellable product."),
        optional(Line,sizeId,Size),require(Size==none,"INVALID_SIZE","demandLines.sizeId",Id,"An unsized product cannot have a pizza size."),
        Mapped=sale(direct_sale(Date,Id,Q))
    ; input_error("INVALID_DEMAND","demandLines.type",Type,"Unknown demand type.") ).
demand_date("BOM",_,none) :- !.
demand_date(_,Line,Date) :- required(Line,date,Text),date_value(Text,Date).

component_selection(Line,Pizzas,Components,Ids) :-
    require(\+ (get_dict(selectedComponents,Line,_),get_dict(selectedComponentIds,Line,_)),
            "INVALID_BOM","selectedComponents",none,"Use one personalised component representation, not both."),
    ( get_dict(selectedComponents,Line,Selected) -> Components=Selected
    ; get_dict(selectedComponentIds,Line,SelectedIds) ->
        require(is_list(SelectedIds),"INVALID_INPUT","selectedComponentIds",none,"Expected an array."),
        findall(json{productId:Id,quantity:1},member(Id,SelectedIds),Components)
    ; required(Line,productId,PizzaId),record(Pizzas,productId,PizzaId,"pizzaConfigurations",Pizza),
      input_list(Pizza,components,Components) ),
    require((is_list(Components),Components\==[]),"INCOMPLETE_BOM","components",none,"A pizza needs components."),
    check_unique_records(Components,productId,"components"),
    findall(Id,(member(C,Components),required(C,productId,Id)),Ids).
map_component(Products,Configs,Size,C,component(Id,Units)) :-
    required(C,productId,Id),required(C,quantity,Multiplicity),positive_units(Multiplicity,"components.quantity"),
    record(Products,productId,Id,"components.productId",P),
    (member(Config,Configs),get_dict(productId,Config,Id),get_dict(sizeId,Config,Size) -> true
    ; input_error("MISSING_CONFIGURATION","componentConfigurations",Id,"No consumption configuration for the selected size.")),
    required(Config,stockUnitsConsumed,Consumed),required(P,tracked,Tracked),
    (Tracked==true ->
        require(Consumed\==null,"MISSING_CONSUMPTION","stockUnitsConsumed",Id,"Tracked component consumption is missing."),
        units(Consumed,"stockUnitsConsumed"),Units is Consumed*Multiplicity
    ; require(Consumed==null,"INVALID_CONSUMPTION","stockUnitsConsumed",Id,"An untracked component has null consumption."),Units=none).
bom_id(PizzaId,Size,Components,BomId) :-
    with_output_to(string(Canonical),write_canonical(bom(PizzaId,Size,Components))),
    crypto_data_hash(Canonical,Hash,[algorithm(sha256),encoding(utf8)]),
    atomics_to_string(["BOM-",Hash],BomId).

map_forecast("BOM",_,_,_,none,none) :- !.
map_forecast(_,Document,Selection,Lines,forecast(Id,Version,Start,End),Reference) :-
    required(Document,forecast,F),required(F,id,Id),identifier(Id,"forecast.id"),required(F,version,Version),identifier(Version,"forecast.version"),
    required(F,startDate,StartText),date_value(StartText,Start),required(F,endDate,EndText),date_value(EndText,End),
    (Selection.demand.type=="forecast" ->
      require((Id==Selection.demand.id,Version==Selection.demand.version),"SOURCE_VERSION_MISMATCH","forecast",Id,
              "Forecast identity/version differs from the selected source.") ; true),
    require(Start@=<End,"INVALID_PERIOD","forecast",Id,"Forecast end precedes its start."),
    findall(Date-Product-Size,(member(L,Lines),required(L,date,Text),date_value(Text,Date),
      require((Date@>=Start,Date@=<End),"INVALID_DATE","forecast.entries",Text,"Entry is outside the forecast period."),
      required(L,productId,Product),optional(L,sizeId,Size)),Keys),unique(Keys,"forecast.entries",Id),
    required(Selection,referenceDate,RefText),date_value(RefText,Reference).

supplier_product_ids(Items,Ids) :-
    findall(Id,(member(item(Id,Kind,true,Acq,_,_),Items),(Kind==terminal;Kind==aggregate,Acq==purchased)),Raw),sort(Raw,Ids).
map_receipts("BOM",_,_,[]) :- !.
map_receipts(_,Document,Items,Receipts) :-
    input_list(Document,pendingDeliveries,Raw),check_unique_records(Raw,receiptId,"pendingDeliveries"),
    maplist(map_receipt(Items),Raw,Receipts).
map_receipt(Items,R,pending_receipt(Id,Product,Quantity,Date)) :-
    required(R,receiptId,Id),required(R,productId,Product),required(R,remainingUnits,Quantity),
    positive_units(Quantity,"pendingDeliveries.remainingUnits"),
    require(memberchk(item(Product,_,true,_,Unit,_),Items),"UNKNOWN_PRODUCT","pendingDeliveries.productId",Product,
            "A receipt must reference a selected tracked product."),
    required(R,stockUnit,QuotedUnit),require(QuotedUnit==Unit,"INCOMPATIBLE_UNITS","pendingDeliveries.stockUnit",Product,"Receipt and product units must match."),
    required(R,expectedDeliveryDate,Text),date_value(Text,Date).
map_offers("BOM",_,_,_,[],none,[]) :- !.
map_offers(_,Document,Selection,Items,Offers,Meta,Provenance) :-
    required(Document,supplierScenario,S),required(Selection,supplierScenario,Wanted),
    required(S,id,Id),required(S,version,Version),
    require((Id==Wanted.id,Version==Wanted.version),"SUPPLIER_VERSION_MISMATCH","supplierScenario",Id,"Supplier version differs from selection."),
    required(S,status,Status),require(Status=="CONFIRMED","SUPPLIER_VERSION_NOT_CONFIRMED","supplierScenario",Id,"Only confirmed offers may enter planning."),
    input_list(S,supplierIds,Suppliers),unique(Suppliers,"supplierIds",Id),maplist(supplier_id,Suppliers),
    input_list(S,offers,Raw),findall(Sup-P,(member(O,Raw),required(O,supplierId,Sup),required(O,productId,P)),Keys),unique(Keys,"offers",Id),
    maplist(map_offer(Items,Suppliers),Raw,Terms),maplist(offer_key,Terms,Pairs),keysort(Pairs,Sorted),pairs_values(Sorted,Offers),
    input_list(S,provenance,Provenance),Meta=json{id:Id,version:Version}.
supplier_id(Id) :- identifier(Id,"supplierIds").
map_offer(Items,Suppliers,O,offer(Supplier,Id,Cents,Covered,Lead,Limit,Unit)) :-
    required(O,supplierId,Supplier),required(O,productId,Id),
    require(memberchk(Supplier,Suppliers),"UNKNOWN_SUPPLIER","offers.supplierId",Supplier,"Offer supplier was not listed."),
    supplier_product_ids(Items,Ids),require(memberchk(Id,Ids),"UNKNOWN_PRODUCT","offers.productId",Id,"Offer is outside selected replenishable products."),
    memberchk(item(Id,_,true,_,ExpectedUnit,_),Items),required(O,stockUnit,Unit),
    require(Unit==ExpectedUnit,"INCOMPATIBLE_UNITS","offers.stockUnit",Id,"Offer must use the product's canonical stock unit."),
    required(O,priceEur,Price),price_cents(Price,Cents),required(O,coveredUnits,Covered),positive_units(Covered,"offers.coveredUnits"),
    required(O,leadTimeDays,Lead),units(Lead,"offers.leadTimeDays"),
    (get_dict(dailyLimit,O,Limit) -> units(Limit,"offers.dailyLimit") ; Limit=none).
offer_key(Offer,(Id-NegCovered-Supplier)-Offer) :-
    Offer=offer(Supplier,Id,_,Covered,_,_,_),NegCovered is -Covered.
price_cents(Text,Cents) :-
    require((string(Text),split_string(Text,".","",Parts),
      (Parts=[Whole] -> Fraction="00" ; Parts=[Whole,F],string_length(F,N),between(1,2,N),
        (N==1 -> string_concat(F,"0",Fraction) ; Fraction=F)),
      decimal_digits(Whole),decimal_digits(Fraction),number_string(W,Whole),number_string(FractionValue,Fraction)),
      "INVALID_PRICE","offers.priceEur",none,"Expected non-negative decimal EUR with at most two fractional digits."),
    Cents is W*100+FractionValue.
decimal_digits(Text) :- string_codes(Text,Codes),Codes\==[],forall(member(C,Codes),between(0'0,0'9,C)).
validate_provenance(P) :-
    required(P,dataset,Dataset),identifier(Dataset,"provenance.dataset"),required(P,source,Source),identifier(Source,"provenance.source"),
    required(P,simulated,Flag),require(memberchk(Flag,[true,false]),"INVALID_PROVENANCE","provenance.simulated",Dataset,"Simulation origin must be explicit."),
    optional(P,version,Version),optional(P,retrievedAt,Retrieved),
    require((Version\==none;Retrieved\==none),"MISSING_PROVENANCE","provenance",Dataset,"Record a version or retrieval time."),
    (Version==none -> true ; identifier(Version,"provenance.version")),
    (Retrieved==none -> true ; provenance_time(Retrieved,Dataset)).

provenance_time(Text,Dataset) :-
    require((string(Text),sub_string(Text,10,1,_,"T"),
      catch(parse_time(Text,iso_8601,_),_,fail)),"INVALID_PROVENANCE","provenance.retrievedAt",Dataset,
      "Expected an ISO-8601 retrieval timestamp.").

% Every selected source needs its own provenance. Offers cannot stand in for
% missing demand/catalogue/stock origins. Replay checks the original selection.
validate_input_provenance(Selection,View,OfferProvenance,Provenance) :-
    required(View,retrievedAt,Captured),provenance_time(Captured,"view"),
    input_list(View,provenance,Operational),
    required(Selection,demand,Demand),optional(Demand,version,DemandVersion),
    (Demand.type=="fixture" -> DemandSim=true ; DemandSim=false),
    (DemandVersion==none -> DemandTime=Captured ; DemandTime=none),
    source_origin("catalogue",Selection.catalogue,Captured,CatalogueOrigin),
    source_origin("stock",Selection.stock,Captured,StockOrigin),
    Base=[origin("demand",Demand.id,DemandVersion,DemandSim,DemandTime),CatalogueOrigin,StockOrigin],
    (get_dict(preparationFixture,Selection,Preparation) ->
      Extra=[origin("recipes",Preparation.id,Preparation.version,true,none)] ; Extra=[]),
    (Selection.calculation=="REQUIREMENTS_PLANNING" ->
      (get_dict(receipts,Selection,ReceiptSource) -> true ; ReceiptSource=Selection.stock),
      source_origin("receipts",ReceiptSource,Captured,ReceiptOrigin),
      Receipts=[ReceiptOrigin],Supplier=Selection.supplierScenario,
      ExpectedOffers=[origin("offers",Supplier.id,Supplier.version,any,none)]
    ; Receipts=[],ExpectedOffers=[]),
    append([Base,Extra,Receipts],ExpectedOperational),
    provenance_group(Operational,ExpectedOperational),provenance_group(OfferProvenance,ExpectedOffers),
    append(Operational,OfferProvenance,Provenance).

source_origin(Dataset,Source,Captured,Origin) :-
    (Source.type=="saved" -> Origin=origin(Dataset,Source.id,Source.version,true,none)
    ; Origin=origin(Dataset,"backoffice",none,false,Captured)).

provenance_group(Records,Expected) :-
    maplist(validate_provenance,Records),check_unique_records(Records,dataset,"provenance"),
    forall(member(origin(Dataset,_,_,_,_),Expected),
      require((member(P,Records),P.dataset==Dataset),"MISSING_PROVENANCE","provenance",Dataset,
        "A selected input group has no provenance.")),
    forall(member(P,Records),require(member(origin(P.dataset,_,_,_,_),Expected),
      "INVALID_PROVENANCE","provenance.dataset",P.dataset,"Unexpected input group provenance.")),
    maplist(provenance_origin(Records),Expected).

provenance_origin(Records,origin(Dataset,Source,Version,Simulated,Retrieved)) :-
    member(P,Records),P.dataset==Dataset,!,
    optional(P,version,ActualVersion),optional(P,retrievedAt,ActualTime),
    require((P.source==Source,(Version==none;ActualVersion==Version),
      (Simulated==any;P.simulated==Simulated),(Retrieved==none;ActualTime==Retrieved)),
      "INVALID_PROVENANCE","provenance",Dataset,
      "Origin, version, simulation flag or retrieval time differs from the selected source.").
