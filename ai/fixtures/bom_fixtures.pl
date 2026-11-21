:- module(bom_fixtures, [bom_fixture/2]).

:- use_module(library(lists)).
:- use_module(library(apply)).

/** <module> Versioned AI06 input mocks for AI01 demonstrations

All fixtures are simulations and return the same ground planning_input contract
as AI06. The core calculation has no dependency on this module.
*/

bom_fixture(worked, Input) :-
    worked_definitions(Boms, Items, Recipes),
    fixture_input(worked,
        [pizza_demand(none, "medium-margherita", 3),
         pizza_demand(none, "large-margherita", 2)],
        Boms, Items, Recipes,
        [stock("PROD-90001", 3), stock("PROD-90002", 3), stock("PROD-90003", 8),
         stock("PROD-90004", 20), stock("PROD-90005", 3), stock("PROD-90006", 7),
         stock("PROD-90007", 3)], Input).

bom_fixture(cheese_example, Input) :-
    fixture_input(cheese_example, [pizza_demand(none, "medium-cheese", 5)],
        [bom("medium-cheese", "PROD-90020", "PSIZE-0002", [component("PROD-90003", 120)])],
        [item("PROD-90003", terminal, true, none, "g", none)], [],
        [stock("PROD-90003", 400)], Input).

bom_fixture(sufficient_stock, Input) :-
    bom_fixture(worked, Base),
    maplist(sufficient_balance, Base.opening_stock, Stock),
    fixture_input(sufficient_stock, Base.pizza_demand, Base.pizza_boms,
                  Base.items, Base.recipes, Stock, Input).

bom_fixture(shortage, Input) :-
    fixture_input(shortage, [pizza_demand(none, "medium-cheese-tomato", 5)],
        [bom("medium-cheese-tomato", "PROD-90020", "PSIZE-0002",
             [component("PROD-90003", 2), component("PROD-90004", 3)])],
        [item("PROD-90003", terminal, true, purchased, "unit", none),
         item("PROD-90004", terminal, true, purchased, "unit", none)], [],
        [stock("PROD-90003", 4), stock("PROD-90004", 0)], Input).

bom_fixture(shared_ingredient, Input) :-
    fixture_input(shared_ingredient,
        [pizza_demand(none, "pizza-a", 1), pizza_demand(none, "pizza-b", 1)],
        [bom("pizza-a", "PIZZA-A", "PSIZE-0002", [component("A", 1), component("premix", 1)]),
         bom("pizza-b", "PIZZA-B", "PSIZE-0002", [component("B", 1)])],
        [item("A", aggregate, true, produced, "unit", none),
         item("B", aggregate, true, produced, "unit", none),
         item("premix", aggregate, true, produced, "unit", none),
         item("flour", terminal, true, purchased, "unit", none),
         item("yeast", terminal, true, purchased, "unit", none)],
        [recipe("A", 1, [ingredient("premix", 1)]),
         recipe("B", 1, [ingredient("premix", 1)]),
         recipe("premix", 2, [ingredient("flour", 3), ingredient("yeast", 1)])],
        [stock("A", 0), stock("B", 0), stock("premix", 1),
         stock("flour", 3), stock("yeast", 1)], Input).

bom_fixture(personalized, Input) :-
    fixture_input(personalized,
        [pizza_demand(none, "medium-ham-cheese", 5), pizza_demand(none, "medium-cheese", 2)],
        [bom("medium-ham-cheese", "PROD-90020", "PSIZE-0002",
             [component("base", 1), component("cheese", 2), component("ham", 1)]),
         bom("medium-cheese", "PROD-90020", "PSIZE-0002",
             [component("base", 1), component("cheese", 2)])],
        [item("base", terminal, true, purchased, "unit", none),
         item("cheese", terminal, true, purchased, "unit", none),
         item("ham", terminal, true, purchased, "unit", none)], [],
        [stock("base", 7), stock("cheese", 10), stock("ham", 4)], Input).

bom_fixture(ordered_ham_cheese, Input) :-
    fixture_input(ordered_ham_cheese,
        [pizza_demand(none, "medium-ham-cheese", 5)],
        [bom("medium-ham-cheese", "PROD-90020", "PSIZE-0002",
             [component("PROD-90003", 2), component("PROD-90008", 1)])],
        [item("PROD-90003", terminal, true, purchased, "unit", none),
         item("PROD-90008", terminal, true, purchased, "unit", none)], [],
        [stock("PROD-90003", 6), stock("PROD-90008", 5)], Input).

bom_fixture(briefcase, Input) :-
    fixture_input(briefcase, [pizza_demand(none, "teaching-assembly", 60)],
        [bom("teaching-assembly", none, "training-size", [component("briefcase", 1)])],
        [item("briefcase", aggregate, true, produced, "unit", none),
         item("bottom", aggregate, true, produced, "unit", none),
         item("lid", aggregate, true, produced, "unit", none),
         item("lock", terminal, true, purchased, "unit", none),
         item("handle", terminal, true, purchased, "unit", none),
         item("metal_latch", terminal, true, purchased, "unit", none),
         item("steel_bar", terminal, true, purchased, "unit", none),
         item("lower_frame", terminal, true, purchased, "unit", none),
         item("upper_frame", terminal, true, purchased, "unit", none)],
        [recipe("briefcase", 1, [ingredient("bottom", 1), ingredient("lid", 1), ingredient("steel_bar", 1)]),
         recipe("bottom", 1, [ingredient("lower_frame", 1), ingredient("lock", 2), ingredient("handle", 1)]),
         recipe("lid", 1, [ingredient("upper_frame", 1), ingredient("metal_latch", 2)])],
        [stock("briefcase", 10), stock("bottom", 20), stock("lid", 30),
         stock("lock", 45), stock("handle", 25), stock("metal_latch", 100),
         stock("steel_bar", 100), stock("lower_frame", 50), stock("upper_frame", 30)], Input).

bom_fixture(iarti, Input) :-
    findall(item(Id, terminal, true, purchased, Unit, none),
            demo_ingredient(Id, Unit, _), Ingredients),
    findall(stock(Id, Units), demo_ingredient(Id, _, Units), IngredientStock),
    Items = [item("classic-dough", aggregate, true, produced, "unit", none),
             item("thin-dough", aggregate, true, produced, "unit", none),
             item("pesto", aggregate, true, purchased, "g", none)|Ingredients],
    Stock = [stock("classic-dough", 3), stock("thin-dough", 0), stock("pesto", 100)|IngredientStock],
    Recipes = [recipe("classic-dough", 4,
                      [ingredient("flour", 1000), ingredient("water", 600), ingredient("yeast", 10),
                       ingredient("salt", 20), ingredient("olive-oil", 20)]),
               recipe("thin-dough", 4,
                      [ingredient("flour", 800), ingredient("water", 440), ingredient("yeast", 8),
                       ingredient("salt", 16), ingredient("olive-oil", 12)])],
    findall(Bom, demo_bom(Bom), Boms),
    findall(pizza_demand(none, BomId, Quantity),
            (demo_bom(bom(BomId, _, SizeId, _)), demo_size(SizeId, Quantity, _)), Demands),
    fixture_input(iarti, Demands, Boms, Items, Recipes, Stock, Input).

bom_fixture(iarti_balanced, Input) :-
    bom_fixture(iarti, Base),
    Stock = [stock("classic-dough", 15), stock("thin-dough", 7),
             stock("pesto", 100),
             stock("flour", 16000), stock("water", 10000), stock("yeast", 200),
             stock("salt", 400), stock("olive-oil", 400), stock("tomato", 7000),
             stock("mozzarella", 6000), stock("ham", 600), stock("basil", 0),
             stock("cheddar", 500), stock("parmesan", 500), stock("gorgonzola", 500),
             stock("chicken", 700), stock("shrimp", 1000), stock("mushrooms", 500),
             stock("pineapple", 700), stock("onion", 600), stock("pepper", 500),
             stock("olives", 500), stock("pepperoni", 700)],
    fixture_input(iarti_balanced, Base.pizza_demand, Base.pizza_boms,
                  Base.items, Base.recipes, Stock, Input).

worked_definitions(
    [bom("medium-margherita", "PROD-90020", "PSIZE-0002",
         [component("PROD-90001", 1), component("PROD-90003", 2), component("PROD-90004", 3)]),
     bom("large-margherita", "PROD-90020", "PSIZE-0003",
         [component("PROD-90001", 2), component("PROD-90003", 3), component("PROD-90004", 4)])],
    [item("PROD-90001", aggregate, true, produced, "unit", none),
     item("PROD-90002", aggregate, true, produced, "unit", none),
     item("PROD-90003", terminal, true, purchased, "unit", none),
     item("PROD-90004", terminal, true, purchased, "unit", none),
     item("PROD-90005", terminal, true, purchased, "unit", none),
     item("PROD-90006", terminal, true, purchased, "unit", none),
     item("PROD-90007", terminal, true, purchased, "unit", none)],
    [recipe("PROD-90001", 1, [ingredient("PROD-90002", 2), ingredient("PROD-90005", 1)]),
     recipe("PROD-90002", 2, [ingredient("PROD-90006", 3), ingredient("PROD-90007", 1)])]).

fixture_input(Name, Demands, Boms, Items, Recipes, Stock, Input) :-
    atom_string(Name, ScenarioId),
    fixture_execution_id(Name, ExecutionId),
    fixture_version(Name, Version),
    findall(Id, (member(item(Id, _, _, _, _, _), Items) ;
                 member(bom(_, Id, _, _), Boms), Id \== none), ProductIds0),
    sort(ProductIds0, ProductIds),
    maplist(product_state, ProductIds, Products),
    findall(Id, member(bom(_, _, Id, _), Boms), SizeIds0),
    sort(SizeIds0, SizeIds),
    maplist(size_state, SizeIds, Sizes),
    Input = planning_input{
        meta:meta{executionId:ExecutionId, scenarioId:ScenarioId, snapshotId:ScenarioId,
                  schemaVersion:1, calculation:"BOM", mode:"current", simulation:true,
                  provenance:[provenance{dataset:"demo", source:"ai01-input-mock",
                                         version:Version, simulated:true}]},
        eligibility:eligibility{products:Products, sizes:Sizes},
        pizza_demand:Demands, pizza_boms:Boms, items:Items, recipes:Recipes,
        opening_stock:Stock, direct_sale_demand:[], offers:[], forecast:none, reference_date:none
    }.

% Version 2 adds the purchased pesto aggregate to the large demonstrations.
fixture_version(Name, "2") :- memberchk(Name, [iarti, iarti_balanced]), !.
fixture_version(_, "1").

% Stable UUIDs keep demonstrations repeatable. AI05 will allocate real run IDs.
fixture_execution_id(worked, "00000000-0000-4000-8000-000000000001").
fixture_execution_id(cheese_example, "00000000-0000-4000-8000-000000000002").
fixture_execution_id(sufficient_stock, "00000000-0000-4000-8000-000000000003").
fixture_execution_id(shortage, "00000000-0000-4000-8000-000000000004").
fixture_execution_id(shared_ingredient, "00000000-0000-4000-8000-000000000005").
fixture_execution_id(personalized, "00000000-0000-4000-8000-000000000006").
fixture_execution_id(briefcase, "00000000-0000-4000-8000-000000000007").
fixture_execution_id(iarti, "00000000-0000-4000-8000-000000000008").
fixture_execution_id(ordered_ham_cheese, "00000000-0000-4000-8000-000000000009").
fixture_execution_id(iarti_balanced, "00000000-0000-4000-8000-000000000010").

product_state(Id, product_active(Id, true)).
size_state(Id, size_active(Id, true)).

sufficient_balance(stock("PROD-90001", _), stock("PROD-90001", 7)) :- !.
sufficient_balance(stock("PROD-90003", _), stock("PROD-90003", 12)) :- !.
sufficient_balance(stock("PROD-90004", _), stock("PROD-90004", 17)) :- !.
sufficient_balance(Stock, Stock).

demo_size("PSIZE-0001", 1, 1).
demo_size("PSIZE-0002", 2, 1).
demo_size("PSIZE-0003", 3, 2).

demo_bom(bom(BomId, PizzaId, SizeId, [component(Dough, Bases)|Toppings])) :-
    demo_pizza(PizzaId, Dough, Recipe),
    demo_size(SizeId, Factor, Bases),
    atomics_to_string([PizzaId, SizeId], "/", BomId),
    maplist(scale_topping(Factor), Recipe, Toppings).

scale_topping(Factor, ingredient(Id, Units), component(Id, Scaled)) :- Scaled is Factor * Units.

demo_pizza("PIZZA-01", "classic-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 80), ingredient("basil", 2)]).
demo_pizza("PIZZA-02", "classic-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 80), ingredient("ham", 40)]).
demo_pizza("PIZZA-03", "thin-dough",
           [ingredient("tomato", 50), ingredient("mozzarella", 40), ingredient("cheddar", 30),
            ingredient("parmesan", 20), ingredient("gorgonzola", 30)]).
demo_pizza("PIZZA-04", "classic-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 70), ingredient("pepperoni", 40),
            ingredient("chicken", 40)]).
demo_pizza("PIZZA-05", "thin-dough",
           [ingredient("tomato", 50), ingredient("mozzarella", 60), ingredient("shrimp", 60),
            ingredient("onion", 20)]).
demo_pizza("PIZZA-06", "classic-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 70), ingredient("ham", 30),
            ingredient("pineapple", 40)]).
demo_pizza("PIZZA-07", "thin-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 60), ingredient("mushrooms", 30),
            ingredient("pepper", 30), ingredient("olives", 15), ingredient("onion", 20)]).
demo_pizza("PIZZA-08", "classic-dough",
           [ingredient("tomato", 60), ingredient("mozzarella", 70), ingredient("basil", 3),
            ingredient("olives", 20), ingredient("pesto", 20)]).

demo_ingredient("flour", "g", 700).
demo_ingredient("water", "ml", 1000).
demo_ingredient("yeast", "g", 30).
demo_ingredient("salt", "g", 100).
demo_ingredient("olive-oil", "ml", 100).
demo_ingredient("tomato", "g", 500).
demo_ingredient("mozzarella", "g", 500).
demo_ingredient("cheddar", "g", 500).
demo_ingredient("parmesan", "g", 500).
demo_ingredient("gorgonzola", "g", 500).
demo_ingredient("ham", "g", 500).
demo_ingredient("pepperoni", "g", 500).
demo_ingredient("chicken", "g", 500).
demo_ingredient("shrimp", "g", 500).
demo_ingredient("mushrooms", "g", 500).
demo_ingredient("pineapple", "g", 500).
demo_ingredient("onion", "g", 500).
demo_ingredient("pepper", "g", 500).
demo_ingredient("olives", "g", 500).
demo_ingredient("basil", "g", 30).
