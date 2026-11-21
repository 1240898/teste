:- module(bom, [bom_requirements/2, stock_lists/3]).

:- use_module(library(assoc)).
:- use_module(library(apply)).
:- use_module(library(lists)).
:- use_module(library(pairs)).

/** <module> AI01 material requirements

The public predicate consumes the request-local planning_input dict agreed with
AI06. Quantities are integers in each item's stock unit. All stock balances in
the result are hypothetical. Expected input errors are returned as diagnostics.
*/

%! bom_requirements(+Input, -Outcome) is det.
%
% Outcome is ok(Lines) or error(Diagnostic). Unexpected programming errors are
% allowed to propagate to the caller. No input terms or global facts are changed.
bom_requirements(Input, Outcome) :-
    catch(
        ( prepare_bom(Input, Prepared),
          net_requirements(Prepared, Lines),
          Outcome = ok(Lines)
        ),
        error(bom_input(Diagnostic), _),
        ( diagnostic_context(Input, Diagnostic, Contextual),
          Outcome = error(Contextual)
        )
    ),
    !.

prepare_bom(Input, Prepared) :-
    ensure(ground(Input), "NON_GROUND_INPUT", "input", none,
           "The planning input must be ground."),
    ensure(is_dict(Input, planning_input), "INVALID_INPUT", "input", none,
           "Expected a planning_input dict."),
    required_field(Input, meta, "meta", Meta),
    ensure(is_dict(Meta), "INVALID_INPUT", "meta", none,
           "Expected execution metadata."),
    required_field(Meta, scenarioId, "meta.scenarioId", ScenarioId),
    identifier(ScenarioId, "meta.scenarioId"),
    required_field(Meta, mode, "meta.mode", Mode),
    ensure(memberchk(Mode, ["current", "historicalReplay"]),
           "INVALID_MODE", "meta.mode", Mode,
           "Execution mode must be current or historicalReplay."),
    input_list(Input, pizza_demand, Demands),
    input_list(Input, pizza_boms, Boms),
    input_list(Input, items, Items),
    input_list(Input, recipes, Recipes),
    input_list(Input, opening_stock, Stock),
    required_field(Input, eligibility, "eligibility", Eligibility),
    ensure(is_dict(Eligibility), "INVALID_INPUT", "eligibility", none,
           "Expected product and size eligibility."),
    input_list(Eligibility, products, ProductStates),
    input_list(Eligibility, sizes, SizeStates),
    index_records(Items, validate_item, "items", ItemIndex),
    index_records(Boms, validate_bom, "pizza_boms", BomIndex),
    index_records(Recipes, validate_recipe, "recipes", RecipeIndex),
    index_records(Stock, validate_stock, "opening_stock", StockIndex),
    index_records(ProductStates, validate_product_state, "eligibility.products", ProductIndex),
    index_records(SizeStates, validate_size_state, "eligibility.sizes", SizeIndex),
    Model = model{items:ItemIndex, boms:BomIndex, recipes:RecipeIndex,
                  stock:StockIndex, products:ProductIndex, sizes:SizeIndex},
    maplist(validate_stock_reference(ItemIndex), Stock),
    maplist(validate_demand(Model), Demands),
    findall(ProductId,
            ( member(pizza_demand(_, BomId, _), Demands),
              get_assoc(BomId, BomIndex, bom(_, _, _, Components)),
              member(component(ProductId, _), Components)
            ), Roots0),
    sort(Roots0, Roots),
    empty_assoc(Empty),
    visit_items(Roots, Model, [], Empty, _, [], Order),
    foldl(add_pizza_demand(Model), Demands, Empty, GrossDemand),
    Prepared = prepared_bom{model:Model, order:Order, demand:GrossDemand}.

input_list(Dict, Key, List) :-
    atom_string(Key, Field),
    required_field(Dict, Key, Field, List),
    ensure(is_list(List), "INVALID_INPUT", Field, none, "Expected a list.").

required_field(Dict, Key, Field, Value) :-
    ( get_dict(Key, Dict, Value) -> true
    ; invalid("MISSING_FIELD", Field, none, "Required input field is missing.")
    ).

index_records(Records, Validator, Field, Index) :-
    empty_assoc(Empty),
    foldl(index_record(Validator, Field), Records, Empty, Index).

index_record(Validator, Field, Record, Before, After) :-
    call(Validator, Record, Id),
    ensure(\+ get_assoc(Id, Before, _), "DUPLICATE_REFERENCE", Field, Id,
           "Each definition must have a unique identifier."),
    put_assoc(Id, Before, Record, After).

validate_item(Item, Id) :-
    ensure(Item = item(Id, Kind, Tracked, Acquisition, Unit, PerSale),
           "INVALID_ITEM", "items", none, "Expected item/6."),
    identifier(Id, "items.productId"),
    ensure(memberchk(Kind, [terminal, aggregate]), "INVALID_CLASSIFICATION", "items.kind", Id,
           "Item kind must be terminal or aggregate."),
    ensure(memberchk(Tracked, [true, false]), "INVALID_TRACKING", "items.tracked", Id,
           "Stock tracking must be explicit."),
    validate_acquisition(Kind, Acquisition, Id),
    validate_stock_unit(Tracked, Unit, Id),
    ensure((PerSale == none ; nonnegative_integer(PerSale)),
           "INVALID_QUANTITY", "items.stockUnitsPerSale", Id,
           "Consumption per sale must be a non-negative integer when supplied.").

validate_acquisition(aggregate, Acquisition, Id) :-
    ensure(memberchk(Acquisition, [produced, purchased]),
           "INVALID_CLASSIFICATION", "items.acquisitionType", Id,
           "An aggregate requires produced or purchased acquisition."), !.
validate_acquisition(terminal, Acquisition, Id) :-
    ensure(memberchk(Acquisition, [none, produced, purchased]),
           "INVALID_CLASSIFICATION", "items.acquisitionType", Id,
           "Unknown acquisition type.").

validate_stock_unit(true, Unit, Id) :-
    ensure(nonempty_string(Unit), "MISSING_STOCK_UNIT", "items.stockUnit", Id,
           "A tracked item requires an explicit stock unit."), !.
validate_stock_unit(false, Unit, Id) :-
    ensure((Unit == none ; nonempty_string(Unit)), "INVALID_STOCK_UNIT", "items.stockUnit", Id,
           "Stock unit must be a string when supplied.").

validate_bom(Bom, Id) :-
    ensure(Bom = bom(Id, PizzaId, SizeId, Components),
           "INVALID_BOM", "pizza_boms", none, "Expected bom/4."),
    identifier(Id, "pizza_boms.bomId"),
    ensure((PizzaId == none ; nonempty_string(PizzaId)),
           "INVALID_REFERENCE", "pizza_boms.pizzaId", Id,
           "A catalogue pizza reference must be a non-empty string."),
    ensure(SizeId \== none, "MISSING_FIELD", "pizza_boms.sizeId", Id,
           "The selected pizza size is missing."),
    identifier(SizeId, "pizza_boms.sizeId"),
    ensure((is_list(Components), Components \= []),
           "INCOMPLETE_BOM", "pizza_boms.components", Id,
           "A pizza requires a non-empty component list."),
    index_records(Components, validate_component, "pizza_boms.components", _).

validate_component(Component, Id) :-
    ensure(Component = component(Id, Units), "INVALID_COMPONENT", "pizza_boms.components", none,
           "Expected component/2."),
    identifier(Id, "pizza_boms.components.productId"),
    ensure((Units == none ; nonnegative_integer(Units)),
           "INVALID_QUANTITY", "pizza_boms.unitsPerPizza", Id,
           "Component consumption must be a non-negative integer or none for an untracked item.").

validate_recipe(Recipe, Id) :-
    ensure(Recipe = recipe(Id, Yield, Ingredients),
           "INVALID_RECIPE", "recipes", none, "Expected recipe/3."),
    identifier(Id, "recipes.productId"),
    ensure(positive_integer(Yield), "INVALID_QUANTITY", "recipes.yieldUnits", Id,
           "Recipe output per batch must be a positive integer."),
    ensure((is_list(Ingredients), Ingredients \= []),
           "INCOMPLETE_RECIPE", "recipes.ingredients", Id,
           "A preparation recipe requires ingredients."),
    index_records(Ingredients, validate_ingredient, "recipes.ingredients", _).

validate_ingredient(Ingredient, Id) :-
    ensure(Ingredient = ingredient(Id, Units),
           "INVALID_RECIPE", "recipes.ingredients", none, "Expected ingredient/2."),
    identifier(Id, "recipes.ingredients.productId"),
    ensure(positive_integer(Units), "INVALID_QUANTITY", "recipes.unitsPerBatch", Id,
           "Ingredient consumption per batch must be a positive integer.").

validate_stock(Stock, Id) :-
    ensure(Stock = stock(Id, Units), "INVALID_STOCK", "opening_stock", none,
           "Expected stock/2."),
    identifier(Id, "opening_stock.productId"),
    ensure(nonnegative_integer(Units), "INVALID_QUANTITY", "opening_stock.availableUnits", Id,
           "Opening stock must be a non-negative integer.").

validate_product_state(State, Id) :-
    ensure(State = product_active(Id, Active), "INVALID_ELIGIBILITY", "eligibility.products", none,
           "Expected product_active/2."),
    validate_state(Id, Active, "eligibility.products").

validate_size_state(State, Id) :-
    ensure(State = size_active(Id, Active), "INVALID_ELIGIBILITY", "eligibility.sizes", none,
           "Expected size_active/2."),
    validate_state(Id, Active, "eligibility.sizes").

validate_state(Id, Active, Field) :-
    identifier(Id, Field),
    ensure(memberchk(Active, [true, false]), "INVALID_ELIGIBILITY", Field, Id,
           "Eligibility must be an explicit boolean.").

validate_stock_reference(Items, stock(Id, _)) :-
    lookup(Items, Id, "UNKNOWN_PRODUCT", "opening_stock", Item),
    Item = item(_, _, Tracked, _, _, _),
    ensure(Tracked == true, "INCONSISTENT_STOCK", "opening_stock", Id,
           "An untracked item must not have an opening balance.").

validate_demand(Model, Demand) :-
    ensure(Demand = pizza_demand(Date, BomId, Quantity),
           "INVALID_DEMAND", "pizza_demand", none, "Expected pizza_demand/3."),
    identifier(BomId, "pizza_demand.bomId"),
    ensure(valid_date(Date), "INVALID_DATE", "pizza_demand.date", BomId,
           "Expected none or a valid calendar date."),
    ensure(nonnegative_integer(Quantity), "INVALID_QUANTITY", "pizza_demand.quantity", BomId,
           "Pizza demand must be a non-negative integer."),
    lookup(Model.boms, BomId, "UNKNOWN_BOM", "pizza_demand.bomId", bom(_, PizzaId, SizeId, Components)),
    active_reference(Model.sizes, SizeId, "UNKNOWN_SIZE", "pizza_boms.sizeId"),
    validate_pizza_reference(PizzaId, Model.products),
    maplist(validate_component_tracking(Model.items), Components).

validate_pizza_reference(none, _) :- !.
validate_pizza_reference(Id, Products) :-
    active_reference(Products, Id, "UNKNOWN_PRODUCT", "pizza_boms.pizzaId").

validate_component_tracking(Items, component(Id, Units)) :-
    lookup(Items, Id, "UNKNOWN_PRODUCT", "pizza_boms.components", item(_, _, Tracked, _, _, _)),
    validate_consumption(Tracked, Units, Id).

validate_consumption(true, Units, Id) :-
    ensure(Units \== none, "MISSING_CONSUMPTION", "pizza_boms.unitsPerPizza", Id,
           "A tracked component requires consumption in its stock units."), !.
validate_consumption(false, Units, Id) :-
    ensure(Units == none, "INCONSISTENT_CONSUMPTION", "pizza_boms.unitsPerPizza", Id,
           "An untracked component uses none for quantified consumption.").

active_reference(Index, Id, MissingCode, Field) :-
    lookup(Index, Id, MissingCode, Field, State),
    arg(2, State, Active),
    ensure(Active == true, "INACTIVE_REFERENCE", Field, Id,
           "The selected input contains an inactive reference.").

visit_items([], _, _, Visited, Visited, Order, Order).
visit_items([Id|Ids], Model, Path, Before, After, Order0, Order) :-
    visit_item(Id, Model, Path, Before, Next, Order0, Order1),
    visit_items(Ids, Model, Path, Next, After, Order1, Order).

% Path is the active DFS chain, while Before/After record completed products.
% Prepending a parent after visiting its children builds a parent-first order.
visit_item(Id, Model, Path, Before, After, Order0, Order) :-
    ( memberchk(Id, Path) ->
        cycle_diagnostic(Id, Path)
    ; get_assoc(Id, Before, _) ->
        After = Before, Order = Order0
    ; lookup(Model.items, Id, "UNKNOWN_PRODUCT", "items", Item),
      active_reference(Model.products, Id, "UNKNOWN_PRODUCT", "eligibility.products"),
      require_opening_stock(Item, Model.stock),
      recipe_children(Item, Model, Children),
      visit_items(Children, Model, [Id|Path], Before, ChildrenVisited, Order0, ChildrenOrder),
      put_assoc(Id, ChildrenVisited, true, After),
      Order = [Id|ChildrenOrder]
    ).

require_opening_stock(item(Id, _, true, _, _, _), Stock) :-
    lookup(Stock, Id, "MISSING_STOCK", "opening_stock", _), !.
require_opening_stock(item(_, _, false, _, _, _), _).

recipe_children(item(Id, aggregate, Tracked, produced, _, _), Model, Children) :-
    !,
    ensure(Tracked == true, "UNTRACKED_PREPARATION", "items.tracked", Id,
           "An internal preparation requires a tracked stock balance."),
    lookup(Model.recipes, Id, "MISSING_RECIPE", "recipes", recipe(_, _, Ingredients)),
    maplist(tracked_ingredient(Model.items), Ingredients),
    findall(Child, member(ingredient(Child, _), Ingredients), Children0),
    sort(Children0, Children).
recipe_children(_, _, []).

tracked_ingredient(Items, ingredient(Id, _)) :-
    lookup(Items, Id, "UNKNOWN_PRODUCT", "recipes.ingredients", item(_, _, Tracked, _, _, _)),
    ensure(Tracked == true, "UNTRACKED_RECIPE_INPUT", "recipes.ingredients", Id,
           "A quantified recipe ingredient requires stock tracking.").

cycle_diagnostic(Id, Path) :-
    append(Before, [Id|_], Path),
    append(Before, [Id], Segment),
    reverse(Segment, Forward),
    append(Forward, [Id], Cycle),
    throw(error(bom_input(diagnostic{code:"CYCLIC_RECIPE", field:"recipes", reference:Id,
                                   message:"Internal preparation recipes contain a cycle.", path:Cycle}), _)).

add_pizza_demand(Model, pizza_demand(_, BomId, Quantity), Before, After) :-
    get_assoc(BomId, Model.boms, bom(_, _, _, Components)),
    foldl(add_component_demand(Quantity), Components, Before, After).

add_component_demand(_, component(_, none), Demand, Demand) :- !.
add_component_demand(Quantity, component(Id, Units), Before, After) :-
    Required is Quantity * Units,
    add_demand(Id, Required, Before, After).

add_demand(_, 0, Demand, Demand) :- !.
add_demand(Id, Quantity, Before, After) :-
    ( get_assoc(Id, Before, Existing) -> Total is Existing + Quantity
    ; Total = Quantity
    ),
    put_assoc(Id, Before, Total, After).

net_requirements(Prepared, Lines) :-
    net_items(Prepared.order, Prepared.model, Prepared.demand, Rows),
    map_list_to_pairs(row_id, Rows, Pairs),
    keysort(Pairs, Sorted),
    pairs_values(Sorted, Lines).

net_items([], _, _, []).
% All parents have contributed before an item is netted. Read its opening stock
% once, expand production for the residual, and return the hypothetical balance.
net_items([Id|Ids], Model, Demand, Rows) :-
    ( get_assoc(Id, Demand, Required), Required > 0 ->
        get_assoc(Id, Model.stock, stock(_, Available)),
        Withdrawn is min(Required, Available),
        Residual is Required - Withdrawn,
        plan_item(Id, Residual, Model, Demand, NextDemand, Batches, Produced, Replenishment),
        Surplus is max(0, Produced - Residual),
        Remaining is Available - Withdrawn + Surplus,
        Row = requirement{productId:Id, requiredUnits:Required, availableUnits:Available,
                          withdrawnUnits:Withdrawn, residualUnits:Residual, batchCount:Batches,
                          plannedProductionUnits:Produced, surplusUnits:Surplus,
                          remainingUnits:Remaining, replenishmentUnits:Replenishment},
        Rows = [Row|Rest]
    ; NextDemand = Demand, Rows = Rest
    ),
    net_items(Ids, Model, NextDemand, Rest).

% Produced aggregates use whole batches rounded up and add ingredient demand.
% A terminal item or purchased aggregate carries its residual to replenishment.
plan_item(Id, Residual, Model, Before, After, Batches, Produced, Replenishment) :-
    get_assoc(Id, Model.items, item(_, Kind, _, Acquisition, _, _)),
    ( Kind == aggregate, Acquisition == produced ->
        get_assoc(Id, Model.recipes, recipe(_, Yield, Ingredients)),
        Batches is (Residual + Yield - 1) // Yield,
        Produced is Batches * Yield,
        Replenishment = 0,
        foldl(add_ingredient_demand(Batches), Ingredients, Before, After)
    ; Batches = 0, Produced = 0, Replenishment = Residual, After = Before
    ).

add_ingredient_demand(Batches, ingredient(Id, Units), Before, After) :-
    Required is Batches * Units,
    add_demand(Id, Required, Before, After).

row_id(Row, Id) :- Id = Row.productId.

%! stock_lists(+Lines, -Withdraw, -Order) is det.
%
% Project validated AI01 result rows into the teacher's (Quantity, Product) pairs.
% Each product already has one row. Positive quantities retain the row order.
stock_lists(Lines, Withdraw, Order) :-
    findall((Quantity, Id),
            ( member(Row, Lines),
              Id = Row.productId,
              Quantity = Row.withdrawnUnits,
              Quantity > 0
            ), Withdraw),
    findall((Quantity, Id),
            ( member(Row, Lines),
              Id = Row.productId,
              Quantity = Row.replenishmentUnits,
              Quantity > 0
            ), Order).

lookup(Index, Id, Code, Field, Value) :-
    ( get_assoc(Id, Index, Value) -> true
    ; invalid(Code, Field, Id, "The required reference is missing from the selected input.")
    ).

identifier(Id, Field) :-
    ensure(nonempty_string(Id), "INVALID_REFERENCE", Field, Id,
           "Identifiers must be non-empty strings.").

nonempty_string(Value) :- string(Value), string_length(Value, Length), Length > 0.
nonnegative_integer(Value) :- integer(Value), Value >= 0.
positive_integer(Value) :- integer(Value), Value > 0.

valid_date(none) :- !.
valid_date(date(Year, Month, Day)) :-
    integer(Year), between(1, 9999, Year),
    integer(Month), between(1, 12, Month),
    integer(Day),
    month_days(Year, Month, Maximum),
    between(1, Maximum, Day).

month_days(Year, 2, Days) :-
    !,
    ( 0 is Year mod 400 -> Days = 29
    ; 0 is Year mod 4, Year mod 100 =\= 0 -> Days = 29
    ; Days = 28
    ).
month_days(_, Month, Days) :-
    nth1(Month, [31,28,31,30,31,30,31,31,30,31,30,31], Days).

ensure(Goal, Code, Field, Reference, Message) :-
    ( call(Goal) -> true ; invalid(Code, Field, Reference, Message) ).

invalid(Code, Field, Reference, Message) :-
    throw(error(bom_input(diagnostic{code:Code, field:Field, reference:Reference, message:Message}), _)).

diagnostic_context(Input, Diagnostic, Contextual) :-
    ( is_dict(Input), get_dict(meta, Input, Meta), is_dict(Meta) ->
        foldl(add_context(Meta), [scenarioId, executionId], Diagnostic, Contextual)
    ; Contextual = Diagnostic
    ).

add_context(Meta, Key, Before, After) :-
    ( get_dict(Key, Meta, Value), nonempty_string(Value) -> put_dict(Key, Before, Value, After)
    ; After = Before
    ).
