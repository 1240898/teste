:- begin_tests(requirements_planning).
:- use_module('../src/requirements_planning').

input(Needs, Stock, Receipts, Offers, Input) :-
    findall(direct_sale(date(2026,11,D),"ham",N),member(D-N,Needs),Sales),
    Input=planning_input{meta:meta{scenarioId:"S",snapshotId:"S0",mode:"current"},
        forecast:forecast("F","1",date(2026,11,10),date(2026,11,13)),reference_date:date(2026,11,11),
        items:[item("ham",terminal,true,none,"g",1)],opening_stock:[stock("ham",Stock)],
        eligibility:eligibility{products:[product_active("ham",true)],sizes:[]},recipes:[],pizza_demand:[],pizza_boms:[],
        direct_sale_demand:Sales,pending_receipts:Receipts,offers:Offers}.

test(mixed_packs) :-
    input([13-5010],0,[],[offer("A","ham",7500,5000,0,none,"g"),offer("B","ham",500,250,0,none,"g")],I),
    requirements_plan(I,ok(P)), assertion(P.costCents == 8000),
    last(P.days,D), assertion(D.closingUnits == 240).

test(protect_tomorrow) :-
    input([12-3,13-4],0,[pending_receipt("R","ham",6,date(2026,11,12))],[],I),
    requirements_plan(I,ok(P)), member(D,P.days), D.dueDate=="2026-11-12",
    assertion(D.lateUnits == 2), assertion(D.unfulfilledUnits == 1), !.

row(P,Date,Product,R) :- member(R,P.days),R.dueDate==Date,R.productId==Product,!.

test(reference_date_and_overdue_receipt) :-
    input([10-3,11-2],4,[pending_receipt("old","ham",50,date(2026,11,10))],[],I),
    requirements_plan(I,ok(P)), row(P,"2026-11-10","ham",Old),row(P,"2026-11-11","ham",Today),
    assertion(Old.onTimeUnits==0),assertion(Old.lateUnits==2),assertion(Old.unfulfilledUnits==1),
    assertion(Today.onTimeUnits==2),member(W,P.warnings),W.code=="OVERDUE_PENDING_RECEIPT",!.

test(whole_pack_daily_limit) :-
    input([13-14],0,[],[offer("A","ham",60,6,0,11,"g"),offer("B","ham",0,6,0,0,"g")],I),
    requirements_plan(I,ok(P)),row(P,"2026-11-13","ham",Day),
    assertion(Day.onTimeUnits==12),assertion(Day.lateUnits==2),assertion(P.costCents==180),
    forall(member(Proposal,P.proposals),(Proposal.lines=[Line],assertion(Line.packCount==1))).

test(source_conservation) :-
    input([12-9,13-4],4,[pending_receipt("R","ham",3,date(2026,11,11))],
        [offer("A","ham",1000,6,0,none,"g")],I),
    requirements_plan(I,ok(P)),row(P,"2026-11-12","ham",First),row(P,"2026-11-13","ham",Second),
    maplist(get_dict(units),First.allocations,[4,3,2]),
    First.allocations=[_,_,Purchased],Second.allocations=[Carried],
    assertion(Carried.sourceRef==Purchased.sourceRef),assertion(Carried.units==4),
    assertion(First.closingUnits==4),assertion(Second.closingUnits==0),
    member(W,P.warnings),W.code=="UNKNOWN_CAPACITY",!.

test(late_after_month_boundary) :-
    input([],0,[],[offer("A","ham",100,1,2,none,"g")],Base),
    Date=date(2028,2,28),
    I=Base.put(_{forecast:forecast("F","1",Date,Date),reference_date:Date,
                 direct_sale_demand:[direct_sale(Date,"ham",1)]}),
    requirements_plan(I,ok(P)),P.days=[Day],Day.allocations=[Allocation],
    assertion(Day.lateUnits==1),assertion(Allocation.availableDate=="2028-03-01").

test(split_offers_on_same_placement_day) :-
    input([12-7],0,[],[offer("A","ham",10,4,0,4,"g"),offer("B","ham",9,3,0,3,"g")],I),
    requirements_plan(I,ok(P)),row(P,"2026-11-12","ham",R),
    assertion(R.onTimeUnits==7),length(R.allocations,2),assertion(P.costCents==19).

test(exhaustive_small_cost_oracle) :-
    forall((between(1,16,Q),between(0,3,Stock)),
      (input([13-Q],Stock,[],[offer("A","ham",5,4,0,none,"g"),offer("B","ham",3,2,0,none,"g")],I),
       requirements_plan(I,ok(P)),
       findall(C,(between(0,4,A),between(0,8,B),Stock+4*A+2*B>=Q,C is 5*A+3*B),Costs),
       min_list(Costs,Expected),assertion(P.costCents==Expected))).

test(missing_factor_even_for_zero_quantity) :-
    input([12-0],0,[],[],Base),
    requirements_plan(Base.put(items,[item("ham",terminal,true,none,"g",none)]),error(E)),
    assertion(E.code=="MISSING_CONSUMPTION").

pizza(Base,Recipes,ExtraItems,ExtraStock,Components,I) :-
    append(Base.items,ExtraItems,Items),append(Base.opening_stock,ExtraStock,Stock),
    findall(product_active(P,true),member(item(P,_,_,_,_,_),Items),Products),
    I=Base.put(_{items:Items,opening_stock:Stock,recipes:Recipes,
        pizza_boms:[bom("B","pizza","M",Components)],pizza_demand:[pizza_demand(date(2026,11,12),"B",1)],
        eligibility:eligibility{products:[product_active("pizza",true)|Products],sizes:[size_active("M",true)]}}).

test(shared_direct_and_two_pizza_sizes) :-
    input([12-3],7,[],[],Base),
    pizza(Base,[],[],[],[component("ham",2)],One),
    I=One.put(_{pizza_boms:[bom("B","pizza","M",[component("ham",2)]),bom("large","pizza","L",[component("ham",4)])],
        pizza_demand:[pizza_demand(date(2026,11,12),"B",1),pizza_demand(date(2026,11,12),"large",1)],
        eligibility:eligibility{products:[product_active("pizza",true),product_active("ham",true)],sizes:[size_active("M",true),size_active("L",true)]}}),
    requirements_plan(I,ok(P)),row(P,"2026-11-12","ham",R),
    assertion(R.requiredUnits==9),assertion(R.onTimeUnits==7),assertion(R.unfulfilledUnits==2).

test(infeasible_batch_releases_other_ingredient) :-
    input([13-3],3,[],[],Base),
    pizza(Base,[recipe("dough",2,[ingredient("ham",3),ingredient("salt",1)])],
        [item("dough",aggregate,true,produced,"u",none),item("salt",terminal,true,purchased,"g",none)],
        [stock("dough",0),stock("salt",0)],[component("dough",1)],I),
    requirements_plan(I,ok(P)),assertion(P.batches==[]),
    row(P,"2026-11-13","ham",Ham),assertion(Ham.onTimeUnits==3),
    row(P,"2026-11-12","salt",Salt),assertion(Salt.unfulfilledUnits==1).

test(late_nested_production_and_feasible_subset) :-
    input([],1,[pending_receipt("R","ham",1,date(2026,11,13))],[],Base),
    pizza(Base,[recipe("mix",1,[ingredient("ham",1)]),recipe("dough",2,[ingredient("mix",1)])],
        [item("mix",aggregate,true,produced,"u",none),item("dough",aggregate,true,produced,"u",none)],
        [stock("mix",0),stock("dough",0)],[component("dough",4)],I),
    requirements_plan(I,ok(P)),row(P,"2026-11-12","dough",R),
    assertion(R.onTimeUnits==2),assertion(R.lateUnits==2),assertion(R.unfulfilledUnits==0),
    forall(member(A,R.allocations),(A.sourceType=="internalProduction",
        member(B,P.batches),B.batchId==A.sourceRef.batchId,B.availableDate==A.availableDate)).

test(no_purchase_for_an_impossible_batch) :-
    input([],0,[],[offer("A","ham",10,1,0,none,"g")],Base),
    pizza(Base,[recipe("dough",1,[ingredient("ham",1),ingredient("salt",1)])],
        [item("dough",aggregate,true,produced,"u",none),item("salt",terminal,true,purchased,"g",none)],
        [stock("dough",0),stock("salt",0)],[component("dough",1)],I),
    requirements_plan(I,ok(P)),assertion(P.proposals==[]),assertion(P.batches==[]).

test(early_receipt_can_clear_backlog_when_later_receipt_protects_deadline) :-
    input([11-2,13-2],0,[pending_receipt("early","ham",2,date(2026,11,11)),
                          pending_receipt("later","ham",2,date(2026,11,12))],[],I),
    requirements_plan(I,ok(P)), row(P,"2026-11-11","ham",Old),row(P,"2026-11-13","ham",Protected),
    Old.allocations=[A],assertion(A.availableDate=="2026-11-11"),assertion(Protected.onTimeUnits==2).

test(offer_order_and_free_packs_are_deterministic) :-
    Offers=[offer("B","ham",0,5,0,none,"g"),offer("A","ham",0,3,0,none,"g")],
    input([13-3],0,[],Offers,I),requirements_plan(I,ok(P)),reverse(Offers,Reordered),
    requirements_plan(I.put(offers,Reordered),ok(Again)),assertion(P==Again),
    P.proposals=[Proposal],assertion(Proposal.supplierId=="A").

test(reject_duplicate_receipt) :-
    R=pending_receipt("R","ham",1,date(2026,11,11)),input([],0,[R,R],[],I),
    requirements_plan(I,error(E)),assertion(E.code=="DUPLICATE_REFERENCE").

test(large_integer_cost_stays_exact) :-
    input([13-2],0,[],[offer("A","ham",9007199254740993,1,0,none,"g")],I),
    requirements_plan(I,ok(P)),assertion(P.costCents==18014398509481986).

:- end_tests(requirements_planning).
