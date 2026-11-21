:- module(requirements_planning,[requirements_plan/2]).
:- use_module(bom).
:- use_module(input_validation).
:- use_module(plan_allocations).
:- use_module(replenishment_search).
:- use_module(library(aggregate)).
:- use_module(library(pairs)).
:- use_module(library(ugraphs)).

requirements_plan(I,Outcome) :-
    catch((validate_input(I), calculate(I,Plan), Outcome=ok(Plan)),
          error(planning_input(Diagnostic),_), Outcome=error(Diagnostic)), !.

% This boundary receives AI06 ground terms. The adapter owns JSON parsing,
% version/confirmation checks and eligibility at capture or replay.
validate_input(I) :-
    require((ground(I),is_dict(I,planning_input)),"INVALID_INPUT","input",none,"Expected sealed planning inputs."),
    required(I,meta,Meta), required(Meta,snapshotId,Snapshot),identifier(Snapshot,"snapshotId"),
    required(I,forecast,F),require(F=forecast(_,_,Start,End),"INVALID_FORECAST","forecast",none,"Expected one dated forecast."),
    required(I,reference_date,Ref),maplist(valid_date,[Start,End,Ref]),
    require(Start@=<End,"INVALID_PERIOD","forecast",none,"The forecast end precedes its start."),
    maplist(input_list(I),[items,opening_stock,recipes,pizza_demand,direct_sale_demand,offers,pending_receipts],_),
    check_snapshot_balances(I),
    maplist(check_sale(I,Start,End),I.direct_sale_demand),
    maplist(check_pizza_date(Start,End),I.pizza_demand),
    maplist(check_offer(I.items),I.offers),maplist(check_receipt(I.items),I.pending_receipts).
check_snapshot_balances(I) :-
    forall(member(stock(_,Q),I.opening_stock),units(Q,"opening_stock.units")),
    findall(Id,member(pending_receipt(Id,_,_,_),I.pending_receipts),ReceiptIds),
    unique(ReceiptIds,"pending_receipts",none),
    findall(S-P,member(offer(S,P,_,_,_,_,_),I.offers),OfferKeys),
    unique(OfferKeys,"offers",none).

valid_date(Date) :-
    require((Date=date(Y,M,D), integer(Y),between(1,9999,Y),integer(M),between(1,12,M),
             integer(D),between(1,31,D),day_number(Date,N),iso_day(N,Text),date_value(Text,Date)),
            "INVALID_DATE","date",none,"Expected a valid calendar date.").
within_period(Start,End,Date) :-
    valid_date(Date),require((Date@>=Start,Date@=<End),"INVALID_DATE","forecast.entries",none,"Entry outside forecast period.").
check_pizza_date(Start,End,Row) :-
    require(Row=pizza_demand(Date,_,_),"INVALID_DEMAND","pizza_demand",none,"Expected dated pizza demand."),
    within_period(Start,End,Date).
check_sale(I,Start,End,Row) :-
    require(Row=direct_sale(Date,P,Q),"INVALID_DEMAND","direct_sale_demand",none,"Expected dated sales."),
    within_period(Start,End,Date), units(Q,"direct_sale_demand.quantity"),
    require(memberchk(item(P,_,Tracked,_,_,Factor),I.items),"UNKNOWN_PRODUCT","direct_sale_demand.productId",P,"Unknown sale product."),
    require(memberchk(product_active(P,true),I.eligibility.products),"INACTIVE_REFERENCE","eligibility.products",P,"Sale product must be eligible in the selected snapshot."),
    ( memberchk(item(P,aggregate,true,produced,_,_),I.items) ->
      require(memberchk(recipe(P,_,_),I.recipes),"MISSING_RECIPE","recipes",P,"Missing internal production recipe.")
    ; true ),
    ( Tracked==true -> require((integer(Factor),Factor>=0),"MISSING_CONSUMPTION","stockUnitsPerSale",P,"Missing stock units per sale."),
      require(memberchk(stock(P,_),I.opening_stock),"MISSING_STOCK","opening_stock",P,"Missing tracked balance.")
    ; true ).
check_offer(Items,Offer) :-
    require(Offer=offer(S,P,C,U,L,Cap,Unit),"INVALID_OFFER","offers",none,"Expected a mapped supplier offer."),
    identifier(S,"offers.supplierId"),units(C,"offers.priceCents"),positive_units(U,"offers.coveredUnits"),
    units(L,"offers.leadTimeDays"),(Cap==none -> true ; units(Cap,"offers.dailyLimit")),
    require((memberchk(item(P,K,true,A,Unit,_),Items),(K==terminal; A==purchased)),
            "INCOMPATIBLE_UNITS","offers.stockUnit",P,"Offer must match a replenishable product and its stock unit.").
check_receipt(Items,Receipt) :-
    require(Receipt=pending_receipt(Id,P,Q,Date),"INVALID_RECEIPT","pending_receipts",none,"Expected a mapped receipt."),
    identifier(Id,"receiptId"),positive_units(Q,"remainingUnits"),valid_date(Date),
    require(memberchk(item(P,_,true,_,_,_),Items),"UNKNOWN_PRODUCT","pending_receipts.productId",P,"Unknown tracked receipt product.").

calculate(Input,Plan) :-
    include(production_recipe(Input.items),Input.recipes,Recipes),
    I=Input.put(recipes,Recipes),
    I.forecast=forecast(Id,Version,Start,End), day_number(Start,First), day_number(End,Last),
    day_number(I.reference_date,Ref), iso_day(Ref,Reference),
    findall(D,between(First,Last,D),Calendar), maplist(iso_day,Calendar,Dates),
    source_lots(I,Ref,Initial,Warnings),
    daily_needs(Calendar,I,Initial,[],Gross0,Roots0),
    combine(Gross0,Gross), combine(Roots0,Roots),
    findall(P,member(stock(P,_),I.opening_stock),StockIds),sort(StockIds,Ids),
    findall(P-C,(member(recipe(P,_,Ingredients),I.recipes),member(ingredient(C,_),Ingredients)),Edges),
    vertices_edges_to_ugraph(Ids,Edges,Directed), require(top_sort(Directed,_),"CYCLIC_RECIPE","recipes",none,"Internal production recipes contain a cycle."),
    transpose_ugraph(Directed,Reverse), ugraph_union(Directed,Reverse,Graph),
    groups(Ids,Graph,Groups),
    maplist(group_lines(I,Ref,Initial,Gross,Roots),Groups,Choices), append(Choices,Lines),
    maplist(line_lot,Lines,Purchases),append(Initial,Purchases,Lots),
    simulate(Roots,I.recipes,Lots,state(Free,Uses,Batches),Outstanding),
    residual_needs(Outstanding,I.recipes,Free,Residual),
    findall(need(D,P,Q),used(Uses,D,P,_,Q),Consumed),
    append(Consumed,Residual,AllNeeds),combine(AllNeeds,Actual),
    findall(Row,(member(D,Calendar),member(P,Ids),day_row(D,P,Actual,Lots,Uses,Batches,Row)),Days),
    findall(json{code:"UNKNOWN_CAPACITY",supplierId:S,productId:P},member(line(S,P,_,_,_,_,_,none),Lines),Conditional),
    findall(json{code:"UNFULFILLED_REQUIREMENT",productId:P,dueDate:D,units:Q,reason:Reason},
        (member(Row,Days),Q=Row.unfulfilledUnits,Q>0,P=Row.productId,D=Row.dueDate,
         shortage_reason(I,P,Reason)),Shortages),
    append([Warnings,Conditional,Shortages],Warnings0), sort(Warnings0,AllWarnings),
    proposals(Lines,Proposals), reverse(Batches,Chronological),maplist(batch_json(Uses),Chronological,BatchRows),
    score_purchase(Lines,Cost,_),
    (member(R,Days), R.unmetAtDeadlineUnits>0 -> Coverage="partial" ; Coverage="onTime"),
    Plan=I.meta.put(json{forecast:json{id:Id,version:Version},referenceDate:Reference,calendar:Dates,coverage:Coverage,
           days:Days,proposals:Proposals,batches:BatchRows,costCents:Cost,warnings:AllWarnings}).

production_recipe(Items,recipe(Product,_,_)) :-
    memberchk(item(Product,aggregate,true,produced,_,_),Items).

source_lots(I,Ref,Lots,Warnings) :-
    T0 is Ref*2,
    findall(lot(T0,0,P,json{snapshotId:I.meta.snapshotId,productId:P},Q),member(stock(P,Q),I.opening_stock),Opening),
    findall(lot(T,1,P,json{receiptId:Id},Q),(member(pending_receipt(Id,P,Q,Date),I.pending_receipts),
            day_number(Date,D),D>=Ref,T is 2*D+1),Incoming),append(Opening,Incoming,Lots),
    findall(json{code:"OVERDUE_PENDING_RECEIPT",receiptId:Id,productId:P,expectedDeliveryDate:Text},
        (member(pending_receipt(Id,P,_,Date),I.pending_receipts),day_number(Date,D),D<Ref,iso_day(D,Text)),Warnings).

% Net produced stock and batch surplus across days when estimating material
% needs. The final physical simulation independently verifies every batch.
daily_needs([],_,_,_,[],[]).
daily_needs([Day|Days],I,Lots,Previous,Gross,Roots) :-
    D is Day*2, include(dated(Day),I.pizza_demand,Pizzas),
    findall(stock(P,Q),(member(stock(P,_),I.opening_stock),
        aggregate_all(sum(N),(member(lot(T,_,P,_,N),Lots),T=<D),Supply),
        (memberchk(delta(P,V),Previous)->true;V=0), Q is max(0,Supply+V)),Stock),
    bom_requirements(I.put(_{pizza_demand:Pizzas,opening_stock:Stock}),BOM),
    (BOM=ok(Rows)->true;BOM=error(E),throw(error(planning_input(E),_))),
    findall(need(D,P,Q),(member(R,Rows),P=R.productId,Q=R.requiredUnits),Materials),
    % AI01 gross rows already include ingredient demand induced by batches.
    % Recover the roots for physical allocation by subtracting exactly those
    % contributions. The allocator then expands only feasible production.
    findall(need(D,P,Q),(member(Row,Rows),P=Row.productId,
         aggregate_all(sum(N),(member(Parent,Rows),Count=Parent.batchCount,Count>0,
              memberchk(recipe(Parent.productId,_,Ingredients),I.recipes),
              member(ingredient(P,PerBatch),Ingredients),N is Count*PerBatch),Derived),
         Q is Row.requiredUnits-Derived,Q>0),Components),
    findall(need(D,P,Q),(member(direct_sale(Date,P,N),I.direct_sale_demand),day_number(Date,Day),
         memberchk(item(P,_,true,_,_,F),I.items),Q is F*N,Q>0),Sales),
    foldl(delta,Rows,Previous,Next), daily_needs(Days,I,Lots,Next,Later,LaterRoots),
    append([Materials,Sales,Later],Gross),append([Components,Sales,LaterRoots],Roots).
dated(D,pizza_demand(Date,_,_)) :- day_number(Date,D).
delta(R,Before,[delta(P,Value)|Rest]) :-
    P=R.productId,(select(delta(P,Old),Before,Rest)->true;Old=0,Rest=Before),
    Value is Old+R.remainingUnits-R.availableUnits.
combine(Needs,Combined) :-
    findall((D-P)-Q,member(need(D,P,Q),Needs),Pairs),keysort(Pairs,Sorted),group_pairs_by_key(Sorted,Grouped),
    findall(need(D,P,Q),(member((D-P)-Qs,Grouped),sum_list(Qs,Q)),Combined).

% Expand only still-outstanding requirements, accounting for batch surplus
% between outstanding entries. These are requirements, never physical stock.
residual_needs(Outstanding,Recipes,Free,Needs) :-
    findall(P-Q,member(lot(_,_,P,_,Q),Free),Balances),
    residual_list(Outstanding,Recipes,Balances,_,Needs,[]).
residual_list([],_,S,S,T,T).
residual_list([need(D,P,N)|Rest],Recipes,Stock,Final,[need(D,P,N)|Needs],Tail) :-
    ( memberchk(recipe(P,Y,Ingredients),Recipes) ->
      partition(for_item(P),Stock,Matches,Other),pairs_values(Matches,Qs),sum_list(Qs,Available),
      Count is (max(0,N-Available)+Y-1)//Y,Left is Available+Count*Y-N,
      findall(need(D,C,V),(member(ingredient(C,U),Ingredients),V is U*Count,V>0),Children),
      residual_list(Children,Recipes,[P-Left|Other],Next,Needs,More)
    ; Next=Stock,More=Needs ),
    residual_list(Rest,Recipes,Next,Final,More,Tail).
for_item(P,P-_).

groups([],_,[]).
groups([P|Ps],G,[Group|More]) :- reachable(P,G,Group),subtract(Ps,Group,Rest),groups(Rest,G,More).
in_group(Ids,need(_,P,_)) :- memberchk(P,Ids).
product_need(P,need(_,P,_)).
group_lines(I,Ref,Lots,Gross,Roots,Ids,Lines) :-
    include(in_group(Ids),Gross,Needs),include(in_group(Ids),Roots,Goals),
    maplist(initial_choice(Needs,I.offers,Ref,Lots),Ids,Each),append(Each,Seed),
    maplist(line_lot,Seed,New),append(Lots,New,Supply),
    ( Ids=[_] -> Lines=Seed
    ; \+ (member(pending_receipt(_,Product,_,_),I.pending_receipts),memberchk(Product,Ids),
           memberchk(recipe(Product,_,_),I.recipes)),
      simulate(Goals,I.recipes,Supply,state(_,Uses,_),[]), \+ (used(Uses,D,_,T,_),T>D) -> Lines=Seed
    ; upper_needs(Goals,I.recipes,Bounds),
      choose_best(joint(Ids,Bounds,I,Ref,Lots,Goals),_,Lines) ).
initial_choice(Needs,Offers,Ref,Lots,P,Lines) :-
    include(product_need(P),Needs,Own),best_schedule(P,Own,Offers,Ref,Lots,Lines).
upper_needs(Goals,Recipes,Bounds) :-
    findall(need(D,P,Q),(member(need(D,Root,N),Goals),expand(Root,N,Recipes,P,Q)),Bounds).
expand(P,N,R,Leaf,Q) :-
    (memberchk(recipe(P,Y,Ingredients),R) -> member(ingredient(C,U),Ingredients),
      M is ((N+Y-1)//Y)*U, expand(C,M,R,Leaf,Q)
    ; Leaf=P,Q=N ).
joint(Ids,Bounds,I,Ref,Lots,Goals,Score,Lines) :-
    maplist(options_for(Bounds,I.offers,Ref),Ids,Choices),append(Choices,Lines),
    maplist(line_lot,Lines,New),append(Lots,New,Supply),
    simulate(Goals,I.recipes,Supply,state(_,Uses,_),_),
    maplist(service(Uses),Goals,On,Filled,Delay),
    score_purchase(Lines,Cost,_),
    findall(Q,(member(P,Ids),aggregate_all(sum(N),member(line(_,P,_,_,_,N,_,_),Lines),Q)),Units),
    Score=k(On,Filled,Delay,Cost,Units,Lines).
options_for(N,O,R,P,Lines) :- options(P,N,O,R,Lines).
service(Uses,need(D,P,_),On,Filled,Delay) :-
    aggregate_all(sum(-Q),(member(served(D,P,T,Q),Uses),T=<D),On),
    aggregate_all(sum(-Q),member(served(D,P,_,Q),Uses),Filled),
    aggregate_all(sum(W),(member(served(D,P,T,Q),Uses),W is Q*max(0,T-D)),Delay).

day_row(D,P,Gross,Lots,Uses,Batches,Row) :-
    Tick is 2*D, iso_day(D,Date),
    aggregate_all(sum(N),member(need(Tick,P,N),Gross),Expected),
    aggregate_all(sum(N),(used(Uses,Tick,P,T,N),T=<Tick),On),
    aggregate_all(sum(N),(used(Uses,Tick,P,T,N),T>Tick),Late),
    Required is max(Expected,On+Late), Left is Required-On-Late, Deficit is Late+Left,
    balance(Tick,P,Lots,Uses,Batches,Opening,Closing),
    findall(A,(member(use(Tick,P,When,At,K,Ref,Q,_),Uses),FulfilDay is When div 2,iso_day(FulfilDay,Fulfilled),kind(K,Type),Day is At div 2,iso_day(Day,Available),
               A=json{sourceType:Type,sourceRef:Ref,availableDate:Available,fulfilmentDate:Fulfilled,units:Q}),Rev),reverse(Rev,Alloc),
    Row=json{dueDate:Date,productId:P,openingUnits:Opening,closingUnits:Closing,requiredUnits:Required,
         onTimeUnits:On,lateUnits:Late,unfulfilledUnits:Left,unmetAtDeadlineUnits:Deficit,allocations:Alloc}.
balance(T,P,Lots,Uses,Batches,Open,Close) :-
    aggregate_all(sum(Q),(member(lot(A,_,P,_,Q),Lots),A=<T),Stock),
    aggregate_all(sum(Q),(member(batch(_,P,A,Q),Batches),A<T),Produced),
    aggregate_all(sum(Q),(used(Uses,_,P,A,Q),A<T),Consumed),Open is Stock+Produced-Consumed,
    aggregate_all(sum(Q),(member(lot(A,_,P,_,Q),Lots),A=:=T+1),Receipts),
    aggregate_all(sum(Q),(member(batch(_,P,A,Q),Batches),A>=T,A=<T+1),Made),
    aggregate_all(sum(Q),(used(Uses,_,P,A,Q),A>=T,A=<T+1),Used),Close is Open+Receipts+Made-Used.
kind(0,"openingStock").
kind(1,"pendingReceipt").
kind(2,"purchaseProposalLine").
kind(3,"internalProduction").
batch_json(Uses,batch(Id,P,T,Q),json{batchId:Id,productId:P,availableDate:Date,
                                    producedUnits:Q,ingredientAllocations:Inputs}) :-
    D is T div 2,iso_day(D,Date),
    findall(json{productId:Item,sourceType:Type,sourceRef:Ref,units:N},
        (member(use(_,Item,_,_,K,Ref,N,batch(Id)),Uses),kind(K,Type)),Inputs).
proposals(Lines,Proposals) :-
    findall((S-D)-J,(member(L,Lines),L=line(S,P,D,A,N,Q,C,_),iso_day(A,Date),
        line_lot(L,lot(_,_,_,R,_)),
        PackUnits is Q//N, PackPrice is C//N,
        J=R.put(json{productId:P,packCount:N,coveredUnits:PackUnits,packPriceCents:PackPrice,
                     purchasedUnits:Q,expectedDeliveryDate:Date,costCents:C})),Pairs),
    keysort(Pairs,Sorted),group_pairs_by_key(Sorted,Groups),
    findall(json{supplierId:S,orderDate:Date,lines:Rows},(member((S-D)-Rows,Groups),iso_day(D,Date)),Proposals).
shortage_reason(I,P,Reason) :-
    (memberchk(recipe(P,_,_),I.recipes) -> Reason="Insufficient ingredients for a whole batch."
    ; memberchk(offer(_,P,_,_,_,_,_),I.offers) -> Reason="Available supply or batch ingredients cannot cover this requirement."
    ; Reason="No configured supplier for this product." ).
