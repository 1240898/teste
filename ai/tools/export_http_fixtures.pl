:- module(export_http_fixtures, [export_fixtures/1]).
:- use_module('../fixtures/bom_fixtures').
:- use_module(library(http/json)).
:- use_module(library(filesex)).

% Development tool only: publish the approved AI01 teaching data as raw HTTP
% source fixtures. The running AI06 adapter never imports bom_fixtures.
export_fixtures(Directory) :-
    make_directory_path(Directory),
    forall(member(Name, [cheese_example, personalized, iarti_balanced, daily_sales, worked]),
           ( source_fixture(Name, Document, File),
             directory_file_path(Directory, File, Path),
             setup_call_cleanup(open(Path, write, Stream, [encoding(utf8)]),
                                json_write_dict(Stream, Document, [width(100)]), close(Stream)) )).

source_fixture(daily_sales, Document, 'daily-sales.json') :- !,
    source_fixture(cheese_example,Base,_),
    Drink=json{productId:"PROD-90030",kind:"terminal",isActive:true,isSellable:true,isPizza:false,
               isPizzaComponent:false,tracked:true,acquisitionType:"PURCHASED",stockUnit:"unit",stockUnitsPerSale:2},
    append(Base.products,[Drink],Products),append(Base.openingStock,[json{productId:"PROD-90030",availableUnits:4,stockUnit:"unit"}],Stock),
    Base.demandLines=[Pizza0],Pizza=Pizza0.put(date,"2026-11-23"),
    Sale=json{type:"directSale",date:"2026-11-24",productId:"PROD-90030",quantity:6},
    findall(Offer,(member(Supplier,["SUP-01","SUP-02","SUP-03"]),
      Quote=json{supplierId:Supplier,productId:"PROD-90030",stockUnit:"unit",priceEur:"8.50",coveredUnits:10,leadTimeDays:1},
      (Supplier=="SUP-01" -> Offer=Quote.put(dailyLimit,0)
      ;Supplier=="SUP-02" -> Offer=Quote.put(dailyLimit,30) ; Offer=Quote)),Drinks),
    append(Base.supplierScenario.offers,Drinks,Offers),Supplier=Base.supplierScenario.put(json{id:"daily-sales",offers:Offers}),
    Document=Base.put(json{id:"daily-sales",products:Products,openingStock:Stock,demandLines:[Pizza,Sale],
      supplierScenario:Supplier,forecast:json{id:"daily-sales-forecast",version:"1",startDate:"2026-11-23",endDate:"2026-11-24"}}).
source_fixture(Name, Document, File) :-
    bom_fixture(Name, Input),
    source_identity(Name, Id, Version, File),
    findall(Product, (member(Item, Input.items), item_json(Item, Product)), ItemProducts),
    findall(PizzaId, member(bom(_, PizzaId, _, _), Input.pizza_boms), PizzaIds0),
    sort(PizzaIds0, PizzaIds),
    findall(json{productId:PizzaId,isActive:true,isSellable:true,isPizza:true,
                 isPizzaComponent:false,tracked:false,acquisitionType:"PRODUCED",
                 kind:"terminal",stockUnit:null,stockUnitsPerSale:null},
            member(PizzaId, PizzaIds), PizzaProducts),
    append(ItemProducts, PizzaProducts, Products),
    findall(json{sizeId:Size,isActive:true}, member(size_active(Size,_), Input.eligibility.sizes), Sizes),
    findall(json{productId:P,availableUnits:Q,stockUnit:Unit},
            (member(stock(P,Q),Input.opening_stock),memberchk(item(P,_,true,_,Unit,_),Input.items)), Stock),
    findall(json{productId:P,yieldUnits:Y,ingredients:Ingredients},
            ( member(recipe(P,Y,Terms),Input.recipes),
              findall(json{productId:C,unitsPerBatch:Q},member(ingredient(C,Q),Terms),Ingredients) ), Recipes),
    source_compositions(Name, Input, PizzaIds, Pizzas, Configs),
    findall(Line, (member(pizza_demand(_,BomId,Q), Input.pizza_demand),
                   member(bom(BomId,P,Size,Components),Input.pizza_boms),
                   demand_json(Name,P,Size,Q,Components,Line)), Demand),
    supplier_json(Id,Version,Input.items,Supplier),
    Base = json{id:Id,version:Version,demandLines:Demand,products:Products,sizes:Sizes,
                pizzaConfigurations:Pizzas,componentConfigurations:Configs,
                openingStock:Stock,pendingDeliveries:[],recipes:Recipes,supplierScenario:Supplier},
    ( Name == iarti_balanced ->
        Document = Base.put(forecast,json{id:"iarti-forecast",version:"2",
                                        startDate:"2026-11-23",endDate:"2026-11-24"})
    ; Document = Base ).

source_identity(cheese_example,"five-medium","1",'five-medium.json').
source_identity(personalized,"personalized","1",'personalized.json').
source_identity(iarti_balanced,"iarti-demo","2",'iarti.json').
source_identity(worked,"chained-dough","1",'chained-dough.json').

item_json(item(Id,Kind,Tracked,Acquisition,Unit,PerSale),
          json{productId:Id,kind:KindString,isActive:true,isSellable:false,isPizza:false,
               isPizzaComponent:true,tracked:Tracked,acquisitionType:AcquisitionString,
               stockUnit:JsonUnit,stockUnitsPerSale:JsonSale}) :-
    atom_string(Kind,KindString), atom_string(Acquisition,AcquisitionString),
    json_optional(Unit,JsonUnit), json_optional(PerSale,JsonSale).
json_optional(none,null) :- !.
json_optional(Value,Value).

source_compositions(iarti_balanced,Input,PizzaIds,Pizzas,Configs) :- !,
    findall(json{productId:P,components:Components},
            (member(P,PizzaIds),bom_fixtures:demo_pizza(P,Dough,Toppings),
             findall(json{productId:C,quantity:Q},
                     (member(ingredient(C,Q),[ingredient(Dough,1)|Toppings])),Components)),Pizzas),
    findall(json{productId:Id,sizeId:Size,stockUnitsConsumed:Units},
            (member(item(Id,_,_,_,_,_),Input.items),bom_fixtures:demo_size(Size,Factor,Bases),
             (memberchk(Id,["classic-dough","thin-dough"]) -> Units=Bases ; Units=Factor)),Configs).
source_compositions(_,Input,PizzaIds,Pizzas,Configs) :-
    findall(json{productId:P,components:Components},
            (member(P,PizzaIds),once(member(bom(_,P,_,CP),Input.pizza_boms)),
             findall(json{productId:C,quantity:1},member(component(C,_),CP),Components)),Pizzas),
    findall(config(Id,Size,Units),
            (member(bom(_,_,Size,CP),Input.pizza_boms),member(component(Id,Units),CP)),Raw),
    sort(Raw,Unique),
    findall(json{productId:Id,sizeId:Size,stockUnitsConsumed:Units},member(config(Id,Size,Units),Unique),Configs).

demand_json(Name,P,Size,Q,Components,Line) :-
    Base = json{type:"pizza",productId:P,sizeId:Size,quantity:Q},
    ( Name == personalized ->
        findall(json{productId:Id,quantity:1},member(component(Id,_),Components),Selected),
        Line = Base.put(selectedComponents,Selected)
    ; Name == iarti_balanced ->
        ( Size == "PSIZE-0003" -> Date="2026-11-24" ; Date="2026-11-23" ),
        Line = Base.put(date,Date)
    ; Line = Base ).

supplier_json(Id,Version,Items,json{id:Id,version:Version,status:"CONFIRMED",
    supplierIds:["SUP-01","SUP-02","SUP-03"],offers:Offers}) :-
    findall(json{supplierId:Supplier,productId:P,stockUnit:Unit,priceEur:Price,
                 coveredUnits:Covered,leadTimeDays:Lead},
            (member(item(P,Kind,true,Acq,Unit,_),Items),
             (Kind==terminal -> true ; Acq==purchased),
             member(pack(Index,Supplier,Covered,Lead),
                    [pack(1,"SUP-01",5000,1),pack(2,"SUP-02",2000,0),pack(3,"SUP-03",250,2)]),
             product_prices(P,Prices),nth1(Index,Prices,Price)),Offers).

% Demonstration quotes in EUR per 5 kg/L, 2 kg/L and 250 g/ml respectively.
% They are simulated scenario data, not claimed market prices.
product_prices("water",["0.50","0.25","0.05"]) :- !.
product_prices("flour",["4.00","1.80","0.30"]) :- !.
product_prices("salt",["2.00","1.00","0.20"]) :- !.
product_prices("yeast",["25.00","11.00","1.75"]) :- !.
product_prices("olive-oil",["30.00","13.00","2.00"]) :- !.
product_prices(P,["35.00","15.00","2.20"]) :- memberchk(P,["mozzarella","cheddar","parmesan","gorgonzola"]),!.
product_prices(P,["12.00","5.50","0.85"]) :- memberchk(P,["tomato","mushrooms","onion","pepper","pineapple","olives"]),!.
product_prices(_,["75.00","31.00","5.00"]).
