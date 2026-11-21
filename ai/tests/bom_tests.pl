:- begin_tests(bom).

:- use_module('../src/bom').
:- use_module('../fixtures/bom_fixtures').
:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(thread)).

test(s03_exact_worked_result) :-
    bom_fixture(worked, Input),
    bom_requirements(Input, ok(Lines)),
    maplist(row_summary, Lines, Rows),
    assertion(Rows == [
        row("PROD-90001", 7, 3, 3, 4, 4, 4, 0, 0, 0),
        row("PROD-90002", 8, 3, 3, 5, 3, 6, 1, 1, 0),
        row("PROD-90003", 12, 8, 8, 4, 0, 0, 0, 0, 4),
        row("PROD-90004", 17, 20, 17, 0, 0, 0, 0, 3, 0),
        row("PROD-90005", 4, 3, 3, 1, 0, 0, 0, 0, 1),
        row("PROD-90006", 9, 7, 7, 2, 0, 0, 0, 0, 2),
        row("PROD-90007", 3, 3, 3, 0, 0, 0, 0, 0, 0)
    ]).

test(s01_sufficient_aggregate_stock_stops_child_demand) :-
    bom_fixture(sufficient_stock, Input),
    bom_requirements(Input, ok(Lines)),
    maplist(row_product, Lines, Ids),
    assertion(Ids == ["PROD-90001", "PROD-90003", "PROD-90004"]),
    forall(member(Row, Lines), assertion(Row.replenishmentUnits == 0)).

test(s02_zero_and_insufficient_stock) :-
    bom_fixture(shortage, Input),
    bom_requirements(Input, ok(Lines)),
    replenishments(Lines, Missing),
    assertion(Missing == ["PROD-90003"-6, "PROD-90004"-15]).

test(s04_purchased_aggregate_ignores_descriptive_children) :-
    bom_fixture(worked, Base),
    replace_item(Base.items, "PROD-90001",
                 item("PROD-90001", aggregate, true, purchased, "unit", none), Items),
    Input = Base.put(items, Items),
    bom_requirements(Input, ok(Lines)),
    replenishments(Lines, Missing),
    assertion(Missing == ["PROD-90001"-4, "PROD-90003"-4]),
    maplist(row_product, Lines, Ids),
    assertion(\+ memberchk("PROD-90002", Ids)).

test(s05_shared_ingredient_is_netted_before_batch_rounding) :-
    bom_fixture(shared_ingredient, Input),
    bom_requirements(Input, ok(Lines)),
    line("premix", Lines, Premix),
    assertion(Premix.requiredUnits == 3),
    assertion(Premix.withdrawnUnits == 1),
    assertion(Premix.batchCount == 1),
    assertion(Premix.plannedProductionUnits == 2),
    replenishments(Lines, Missing),
    assertion(Missing == []).

test(s05_reordering_definitions_preserves_result) :-
    bom_fixture(shared_ingredient, Base),
    reverse(Base.pizza_demand, Demands), reverse(Base.pizza_boms, Boms),
    reverse(Base.items, Items), reverse(Base.recipes, Recipes), reverse(Base.opening_stock, Stock),
    Input = Base.put(_{pizza_demand:Demands, pizza_boms:Boms, items:Items,
                       recipes:Recipes, opening_stock:Stock}),
    bom_requirements(Base, Expected), bom_requirements(Input, Actual),
    assertion(Actual == Expected).

test(s06_no_base_stock_expands_remaining_recipes) :-
    bom_fixture(worked, Base),
    replace_stock(Base, "PROD-90001", 0, Input),
    bom_requirements(Input, ok(Lines)),
    line("PROD-90006", Lines, Flour), assertion(Flour.requiredUnits == 18),
    line("PROD-90007", Lines, Yeast), assertion(Yeast.requiredUnits == 6),
    line("PROD-90005", Lines, Water), assertion(Water.requiredUnits == 7),
    line("PROD-90002", Lines, Premix), assertion(Premix.remainingUnits == 1).

test(s07_empty_demand) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, []),
    assertion(bom_requirements(Input, ok([]))).

test(s07_zero_quantity) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(none, "medium-cheese", 0)]),
    assertion(bom_requirements(Input, ok([]))).

test(s07_invalid_demand_quantities, [forall(member(Quantity, [-1, 1.5, "5", true]))]) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(none, "medium-cheese", Quantity)]),
    expect_error("INVALID_QUANTITY", Input).

test(s07_negative_stock) :-
    bom_fixture(cheese_example, Base), replace_stock(Base, "PROD-90003", -1, Input),
    expect_error("INVALID_QUANTITY", Input).

test(s07_invalid_recipe_quantities, [forall(member(Recipe, [
    recipe("PROD-90001", 0, [ingredient("PROD-90002", 1)]),
    recipe("PROD-90001", 1.5, [ingredient("PROD-90002", 1)]),
    recipe("PROD-90001", 1, [ingredient("PROD-90002", 0)]),
    recipe("PROD-90001", 1, [ingredient("PROD-90002", -1)])
]))]) :-
    bom_fixture(worked, Base),
    Input = Base.put(recipes, [Recipe]),
    expect_error("INVALID_QUANTITY", Input).

test(s08_unknown_bom_even_for_zero_quantity) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(none, "missing", 0)]),
    expect_error("UNKNOWN_BOM", Input).

test(s08_unknown_size) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_boms, [bom("medium-cheese", "PROD-90020", "missing", [component("PROD-90003", 120)])]),
    expect_error("UNKNOWN_SIZE", Input).

test(s08_unknown_component) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_boms, [bom("medium-cheese", none, "PSIZE-0002", [component("missing", 120)])]),
    expect_error("UNKNOWN_PRODUCT", Input).

test(s08_missing_stock) :-
    bom_fixture(cheese_example, Base), Input = Base.put(opening_stock, []),
    expect_error("MISSING_STOCK", Input).

test(s08_missing_consumption) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_boms, [bom("medium-cheese", none, "PSIZE-0002", [component("PROD-90003", none)])]),
    expect_error("MISSING_CONSUMPTION", Input).

test(s08_zero_consumption) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_boms, [bom("medium-cheese", none, "PSIZE-0002", [component("PROD-90003", 0)])]),
    assertion(bom_requirements(Input, ok([]))).

test(s08_untracked_component) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(_{pizza_boms:[bom("medium-cheese", none, "PSIZE-0002", [component("PROD-90003", none)])],
                       items:[item("PROD-90003", terminal, false, purchased, none, none)], opening_stock:[]}),
    assertion(bom_requirements(Input, ok([]))).

test(s08_missing_internal_recipe_even_with_sufficient_stock) :-
    bom_fixture(sufficient_stock, Base), Input = Base.put(recipes, []),
    expect_error("MISSING_RECIPE", Input).

test(s08_unknown_recipe_child) :-
    bom_fixture(worked, Base),
    Input = Base.put(recipes, [recipe("PROD-90001", 1, [ingredient("missing", 1)])]),
    expect_error("UNKNOWN_PRODUCT", Input).

test(s09_cycle_even_with_sufficient_stock) :-
    bom_fixture(sufficient_stock, Base),
    Input = Base.put(recipes, [recipe("PROD-90001", 1, [ingredient("PROD-90002", 1)]),
                              recipe("PROD-90002", 1, [ingredient("PROD-90001", 1)])]),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.code == "CYCLIC_RECIPE"),
    assertion(Diagnostic.path == ["PROD-90001", "PROD-90002", "PROD-90001"]).

test(s09_self_cycle) :-
    bom_fixture(worked, Base),
    Input = Base.put(recipes, [recipe("PROD-90001", 1, [ingredient("PROD-90001", 1)])]),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.path == ["PROD-90001", "PROD-90001"]).

test(core_repeated_calls_are_deterministic_and_keep_input) :-
    bom_fixture(worked, Input), copy_term(Input, Original),
    findall(Result, bom_requirements(Input, Result), Results),
    Results = [First],
    bom_requirements(Input, Second), assertion(First == Second),
    assertion(Input == Original).

test(core_parallel_calls_keep_independent_values) :-
    bom_fixture(cheese_example, FirstInput),
    replace_stock(FirstInput, "PROD-90003", 600, SecondInput),
    concurrent(2, [bom_requirements(FirstInput, First), bom_requirements(SecondInput, Second)], []),
    First = ok([Short]), Second = ok([Covered]),
    assertion(Short.replenishmentUnits == 200),
    assertion(Covered.replenishmentUnits == 0),
    assertion(FirstInput.opening_stock == [stock("PROD-90003", 400)]).

test(s11_inactive_reference, [forall(member(Type, [product, size]))]) :-
    bom_fixture(cheese_example, Base),
    inactive_input(Type, Base, Input),
    expect_error("INACTIVE_REFERENCE", Input).

test(valid_execution_modes_preserve_calculation) :-
    bom_fixture(cheese_example, Base),
    Meta = Base.meta.put(_{mode:"historicalReplay", replayedFrom:"previous-run"}),
    Input = Base.put(meta, Meta),
    bom_requirements(Base, Expected), bom_requirements(Input, Actual),
    assertion(Actual == Expected).

test(invalid_execution_mode, [forall(member(Mode, [unknown, 0, "unsupported"]))]) :-
    bom_fixture(cheese_example, Base),
    Meta = Base.meta.put(mode, Mode), Input = Base.put(meta, Meta),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.code == "INVALID_MODE"),
    assertion(Diagnostic.field == "meta.mode"),
    assertion(Diagnostic.reference == Mode),
    assertion(Diagnostic.scenarioId == Base.meta.scenarioId),
    assertion(Diagnostic.executionId == Base.meta.executionId).

test(missing_execution_mode) :-
    bom_fixture(cheese_example, Base),
    del_dict(mode, Base.meta, _, Meta), Input = Base.put(meta, Meta),
    expect_error("MISSING_FIELD", Input).

test(s12_ai06_cheese_example_and_dated_ai02_input) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(date(2026,11,19), "medium-cheese", 5)]),
    bom_requirements(Base, Expected), bom_requirements(Input, Actual),
    assertion(Actual == Expected).

test(s13_five_medium_ham_cheese_pizzas) :-
    bom_fixture(ordered_ham_cheese, Input),
    bom_requirements(Input, ok(Lines)),
    line("PROD-90003", Lines, Mozzarella), line("PROD-90008", Lines, Ham),
    assertion(Mozzarella.requiredUnits == 10), assertion(Mozzarella.withdrawnUnits == 6),
    assertion(Ham.requiredUnits == 5), assertion(Ham.withdrawnUnits == 5),
    replenishments(Lines, Missing), assertion(Missing == ["PROD-90003"-4]).

test(s13_order_and_forecast_normalized_demand_match) :-
    bom_fixture(ordered_ham_cheese, Order),
    Forecast = Order.put(pizza_demand, [pizza_demand(date(2026,11,19), "medium-ham-cheese", 5)]),
    bom_requirements(Order, Expected), bom_requirements(Forecast, Actual),
    assertion(Actual == Expected).

test(s13_missing_normalized_size) :-
    bom_fixture(ordered_ham_cheese, Base),
    Base.pizza_boms = [bom(Id, PizzaId, _, Components)],
    Input = Base.put(pizza_boms, [bom(Id, PizzaId, none, Components)]),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.code == "MISSING_FIELD"),
    assertion(Diagnostic.field == "pizza_boms.sizeId"),
    assertion(Diagnostic.reference == Id).

test(s13_invalid_normalized_size, [forall(member(Size, ["", 42]))]) :-
    bom_fixture(ordered_ham_cheese, Base),
    Base.pizza_boms = [bom(Id, PizzaId, _, Components)],
    Input = Base.put(pizza_boms, [bom(Id, PizzaId, Size, Components)]),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.code == "INVALID_REFERENCE"),
    assertion(Diagnostic.field == "pizza_boms.sizeId"),
    assertion(Diagnostic.reference == Size).

test(s14_personalized_compositions_share_catalogue_id) :-
    bom_fixture(personalized, Input), bom_requirements(Input, ok(Lines)),
    replenishments(Lines, Missing),
    assertion(Missing == ["cheese"-4, "ham"-1]).

test(s14_personalized_without_catalogue_reference) :-
    bom_fixture(personalized, Base),
    Base.pizza_boms = [First, bom(Id, _, Size, Components)],
    Input = Base.put(pizza_boms, [First, bom(Id, none, Size, Components)]),
    bom_requirements(Base, Expected), bom_requirements(Input, Actual),
    assertion(Actual == Expected).

test(s18_terminal_produced_item_is_not_expanded) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(_{items:[item("PROD-90003", terminal, true, produced, "g", none)],
                       recipes:[recipe("PROD-90003", 1, [ingredient("descriptive-child", 1)])]}),
    bom_requirements(Input, ok([Row])), assertion(Row.replenishmentUnits == 200).

test(s19_invalid_classification, [forall(member(Item, [
    item("PROD-90003", unknown, true, purchased, "g", none),
    item("PROD-90003", aggregate, true, none, "g", none),
    item("PROD-90003", aggregate, true, unknown, "g", none)
]))]) :-
    bom_fixture(cheese_example, Base), Input = Base.put(items, [Item]),
    expect_error("INVALID_CLASSIFICATION", Input).

test(duplicate_bom) :-
    bom_fixture(cheese_example, Base), Base.pizza_boms = [Bom],
    Input = Base.put(pizza_boms, [Bom, Bom]), expect_error("DUPLICATE_REFERENCE", Input).

test(duplicate_stock) :-
    bom_fixture(cheese_example, Base), Base.opening_stock = [Stock],
    Input = Base.put(opening_stock, [Stock, Stock]), expect_error("DUPLICATE_REFERENCE", Input).

test(duplicate_recipe_ingredient) :-
    bom_fixture(worked, Base),
    Input = Base.put(recipes, [recipe("PROD-90001", 1, [ingredient("PROD-90002", 1), ingredient("PROD-90002", 1)])]),
    expect_error("DUPLICATE_REFERENCE", Input).

test(malformed_input, [forall(member(Input, [none, [], planning_input{}]))]) :-
    bom_requirements(Input, error(Diagnostic)), assertion(ground(Diagnostic)).

test(non_ground_input_returns_diagnostic) :-
    bom_requirements(_, error(Diagnostic)), assertion(Diagnostic.code == "NON_GROUND_INPUT").

test(invalid_calendar_date) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(date(2026,2,29), "medium-cheese", 5)]),
    expect_error("INVALID_DATE", Input).

test(valid_leap_day) :-
    bom_fixture(cheese_example, Base),
    Input = Base.put(pizza_demand, [pizza_demand(date(2028,2,29), "medium-cheese", 5)]),
    bom_requirements(Input, ok([Row])), assertion(Row.requiredUnits == 600).

test(integer_arithmetic_does_not_round_large_quantities) :-
    bom_fixture(cheese_example, Base), Quantity is 2^53 + 1,
    Input = Base.put(pizza_demand, [pizza_demand(none, "medium-cheese", Quantity)]),
    bom_requirements(Input, ok([Row])), Expected is Quantity * 120,
    assertion(Row.requiredUnits == Expected).

test(diagnostics_include_scenario_and_affected_reference) :-
    bom_fixture(cheese_example, Base), Input = Base.put(opening_stock, []),
    bom_requirements(Input, error(Diagnostic)),
    assertion(Diagnostic.scenarioId == "cheese_example"),
    assertion(Diagnostic.reference == "PROD-90003").

test(professor_briefcase_example) :-
    bom_fixture(briefcase, Input), bom_requirements(Input, ok(Lines)),
    replenishments(Lines, Missing), assertion(Missing == ["handle"-5, "lock"-15]),
    line("briefcase", Lines, Case), assertion(Case.withdrawnUnits == 10),
    line("bottom", Lines, Bottom), assertion(Bottom.withdrawnUnits == 20),
    line("lid", Lines, Lid), assertion(Lid.withdrawnUnits == 30).

test(professor_withdrawal_and_order_lists) :-
    bom_fixture(briefcase, Input), bom_requirements(Input, ok(Lines)),
    stock_lists(Lines, Withdraw, Order),
    assertion(Withdraw == [(20,"bottom"),(10,"briefcase"),(25,"handle"),
                          (30,"lid"),(45,"lock"),(30,"lower_frame"),
                          (40,"metal_latch"),(50,"steel_bar"),(20,"upper_frame")]),
    assertion(Order == [(5,"handle"),(15,"lock")]).

test(stock_lists_exclude_zero_withdrawals) :-
    bom_fixture(shortage, Input), bom_requirements(Input, ok(Lines)),
    stock_lists(Lines, Withdraw, Order),
    assertion(Withdraw == [(4,"PROD-90003")]),
    assertion(Order == [(6,"PROD-90003"),(15,"PROD-90004")]).

test(stock_lists_with_sufficient_stock) :-
    bom_fixture(sufficient_stock, Input), bom_requirements(Input, ok(Lines)),
    stock_lists(Lines, Withdraw, Order),
    assertion(Withdraw == [(7,"PROD-90001"),(12,"PROD-90003"),(17,"PROD-90004")]),
    assertion(Order == []).

test(stock_lists_empty_result) :-
    assertion(stock_lists([], [], [])).

test(iarti_dataset_counts_and_nonnegative_balances) :-
    bom_fixture(iarti, Input),
    length(Input.eligibility.sizes, 3), length(Input.pizza_boms, 24),
    findall(Id, member(bom(_, Id, _, _), Input.pizza_boms), PizzaIds),
    sort(PizzaIds, Pizzas), length(Pizzas, 8),
    length(Input.recipes, 2), length(Input.items, 23),
    bom_requirements(Input, ok(Lines)),
    length(Lines, 23),
    forall(member(Row, Lines), assert_balance_invariants(Row)).

test(iarti_balanced_has_covered_partial_and_missing_stock) :-
    bom_fixture(iarti_balanced, Input), bom_requirements(Input, ok(Lines)),
    length(Lines, 23),
    replenishments(Lines, Missing),
    assertion(Missing == ["basil"-70,"ham"-380,"mozzarella"-1420,"pesto"-180]),
    line("tomato", Lines, Tomato), assertion(Tomato.remainingUnits == 560),
    line("flour", Lines, Flour), assertion(Flour.requiredUnits == 12000),
    assertion(Flour.remainingUnits == 4000),
    line("classic-dough", Lines, Dough), assertion(Dough.withdrawnUnits == 15),
    assertion(Dough.plannedProductionUnits == 32), assertion(Dough.remainingUnits == 2).

test(iarti_purchased_aggregate_shortfall,
     [forall(member(Name, [iarti, iarti_balanced]))]) :-
    bom_fixture(Name, Input), bom_requirements(Input, ok(Lines)),
    assertion(memberchk(item("pesto", aggregate, true, purchased, "g", none), Input.items)),
    assertion(\+ memberchk(recipe("pesto", _, _), Input.recipes)),
    Input.meta.provenance = [Source], assertion(Source.version == "2"),
    line("pesto", Lines, Pesto), row_summary(Pesto, Summary),
    assertion(Summary == row("pesto", 280, 100, 100, 180, 0, 0, 0, 0, 180)).

% All result fields are compared in S03 in the order used by this summary.
row_summary(Row, row(Id, Required, Available, Withdrawn, Residual, Batches, Produced, Surplus, Remaining, Missing)) :-
    Id = Row.productId, Required = Row.requiredUnits, Available = Row.availableUnits,
    Withdrawn = Row.withdrawnUnits, Residual = Row.residualUnits, Batches = Row.batchCount,
    Produced = Row.plannedProductionUnits, Surplus = Row.surplusUnits,
    Remaining = Row.remainingUnits, Missing = Row.replenishmentUnits.

row_product(Row, Id) :- Id = Row.productId.

line(Id, Lines, Row) :- member(Row, Lines), Row.productId == Id, !.

replenishments(Lines, Missing) :-
    findall(Id-Units, (member(Row, Lines), Id = Row.productId,
                      Units = Row.replenishmentUnits, Units > 0), Missing).

replace_stock(Base, Id, Units, Input) :-
    selectchk(stock(Id, _), Base.opening_stock, Rest),
    Input = Base.put(opening_stock, [stock(Id, Units)|Rest]).

replace_item(Items, Id, Replacement, Result) :-
    selectchk(item(Id, _, _, _, _, _), Items, Rest), Result = [Replacement|Rest].

inactive_input(product, Base, Input) :-
    Eligibility = Base.eligibility.put(products, [product_active("PROD-90020", false),
                                                 product_active("PROD-90003", true)]),
    Input = Base.put(eligibility, Eligibility).
inactive_input(size, Base, Input) :-
    Eligibility = Base.eligibility.put(sizes, [size_active("PSIZE-0002", false)]),
    Input = Base.put(eligibility, Eligibility).

expect_error(Code, Input) :-
    bom_requirements(Input, error(Diagnostic)), assertion(Diagnostic.code == Code).

assert_balance_invariants(Row) :-
    assertion(Row.requiredUnits =:= Row.withdrawnUnits + Row.residualUnits),
    assertion(Row.withdrawnUnits =< Row.availableUnits),
    assertion(Row.remainingUnits =:= Row.availableUnits - Row.withdrawnUnits + Row.surplusUnits),
    assertion(Row.remainingUnits >= 0).

:- end_tests(bom).
