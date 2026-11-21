:- module(demo_inputs, [demo_inputs/0]).
:- use_module(src/planning_inputs).
:- use_module(src/bom).
:- use_module(src/requirements_planning).
:- use_module(src/json_boundary).
:- use_module(library(http/json)).

% The portal passes only the registered scheduling/selection context on stdin.
demo_inputs :-
    set_stream(current_input,encoding(utf8)),set_stream(current_output,encoding(utf8)),
    json_read_dict(current_input,Execution,[default_tag(json)]),
    load_inputs(Execution,Outcome),
    demo_outcome(Outcome,Response),write_planning_json(current_output,Response),nl.
demo_outcome(error(Diagnostic),json{error:Diagnostic}).
demo_outcome(ok(Input),Response) :-
    maplist(term_json,Input.pizza_demand,Pizzas),maplist(term_json,Input.direct_sale_demand,Sales),
    maplist(term_json,Input.offers,Offers),maplist(term_json,Input.pizza_boms,Boms),
    maplist(term_json,Input.items,Items),maplist(term_json,Input.recipes,Recipes),
    maplist(term_json,Input.opening_stock,Stock),
    maplist(term_json,Input.pending_receipts,Receipts),
    term_json(Input.forecast,Forecast),term_json(Input.reference_date,Reference),
    Base=Input.meta.put(json{pizzaDemand:Pizzas,directSaleDemand:Sales,offers:Offers,
                            pizzaBoms:Boms,items:Items,recipes:Recipes,openingStock:Stock,
                            forecast:Forecast,referenceDate:Reference,pendingReceipts:Receipts}),
    ( Input.meta.calculation=="BOM" -> bom_requirements(Input,Result),bom_result(Result,Base,Response)
    ; requirements_plan(Input,PlanOutcome),
      (PlanOutcome=ok(Plan) -> Response=Base.put(requirementsPlan,Plan)
      ; PlanOutcome=error(E), Response=Base.put(error,E)) ).
bom_result(ok(Lines),Base,Response) :- Response=Base.put(lines,Lines).
bom_result(error(Diagnostic),Base,Response) :- Response=Base.put(error,Diagnostic).
term_json(Term,String) :- term_string(Term,String,[quoted(true)]).
